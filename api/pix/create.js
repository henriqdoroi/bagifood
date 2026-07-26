import { bravopay } from "../_lib/bravopay.js";

function firstNonEmpty(...values) {
    for (const value of values) {
        const text = String(value ?? "").trim();
        if (text) return text;
    }
    return "";
}

function resolvePixVisualData(transaction) {
    const pix = transaction?.pix || {};
    const paymentCode = firstNonEmpty(
        pix.copy_paste,
        pix.copyPaste,
        pix.emv,
        pix.payload,
        transaction?.pix_code,
        transaction?.pixCode,
        transaction?.copy_paste,
        transaction?.copyPaste
    );
    const paymentQrUrl = firstNonEmpty(
        pix.qr_code_url,
        pix.qrcode_url,
        pix.qrCodeUrl,
        pix.image_url,
        pix.imageUrl,
        transaction?.qr_code_url,
        transaction?.qrCodeUrl
    );
    const paymentCodeBase64 = firstNonEmpty(
        pix.qr_code_base64,
        pix.qrcode_base64,
        pix.qrCodeBase64,
        pix.base64,
        transaction?.qr_code_base64,
        transaction?.qrCodeBase64
    ).replace(/^data:image\/[^;]+;base64,/i, "");
    return { paymentCode, paymentQrUrl, paymentCodeBase64 };
}

// ---------------------------------------------------------------------------
// Captura AMPLA de parâmetros de rastreamento.
//
// Cada chave do mapa abaixo é o nome "canônico" que vamos enviar ao BravoPay.
// A lista de aliases cobre variações comuns: com/sem prefixo "utm_", camelCase,
// snake_case, etc. Isso garante que não importa qual formato o front-end
// (getUtmData() em script.js) esteja usando hoje ou passe a usar no futuro,
// o valor é capturado.
// ---------------------------------------------------------------------------
const TRACKING_ALIASES = {
    // UTMs clássicas
    source: ["utm_source", "source", "utmSource"],
    medium: ["utm_medium", "medium", "utmMedium"],
    campaign: ["utm_campaign", "campaign", "utmCampaign"],
    content: ["utm_content", "content", "utmContent"],
    term: ["utm_term", "term", "utmTerm"],

    // Extensões mais novas de UTM (Google Ads)
    utm_id: ["utm_id", "utmId"],
    utm_source_platform: ["utm_source_platform", "utmSourcePlatform"],
    utm_creative_format: ["utm_creative_format", "utmCreativeFormat"],
    utm_marketing_tactic: ["utm_marketing_tactic", "utmMarketingTactic"],

    // Click IDs por plataforma
    fbclid: ["fbclid"],                 // Meta / Facebook / Instagram
    gclid: ["gclid"],                   // Google Ads
    gbraid: ["gbraid"],                 // Google Ads (iOS, app-to-web)
    wbraid: ["wbraid"],                 // Google Ads (iOS, web-to-app)
    dclid: ["dclid"],                   // Google Display / Campaign Manager
    msclkid: ["msclkid"],               // Microsoft / Bing Ads
    ttclid: ["ttclid"],                 // TikTok Ads
    twclid: ["twclid"],                 // Twitter / X Ads
    li_fat_id: ["li_fat_id", "liFatId"],// LinkedIn Ads
    epik: ["epik"],                     // Pinterest
    sccid: ["sccid", "ScCid"],          // Snapchat
    rdt_cid: ["rdt_cid", "rdtCid"],     // Reddit Ads
    yclid: ["yclid"],                   // Yandex
    obclid: ["obclid"],                 // Outbrain
    ttp: ["ttp"],                       // TikTok Pixel (browser id)

    // Cookies do Facebook usadas para melhorar o match (não são UTM, mas
    // ajudam a atribuição quando presentes no front-end)
    fbp: ["fbp", "_fbp"],
    fbc: ["fbc", "_fbc"],

    // Identificadores genéricos de clique/sessão que alguma plataforma nova
    // possa usar
    click_id: ["click_id", "clickId"],
    sub_id: ["sub_id", "subId"],
};

// Chaves que já são tratadas explicitamente acima (usadas para não duplicar
// no passo de captura dinâmica abaixo).
const KNOWN_ALIASES = new Set(
    Object.values(TRACKING_ALIASES).flat().map((k) => k.toLowerCase())
);

function normalizeUtm(utm = {}, body = {}) {
    // Mescla as duas fontes possíveis: o objeto "utm" dedicado e o corpo cru
    // da requisição (caso o front-end mande os campos soltos).
    const merged = { ...body, ...utm };

    const result = {};

    // 1) Captura explícita de tudo que já conhecemos, testando os aliases.
    for (const [canonicalKey, aliases] of Object.entries(TRACKING_ALIASES)) {
        const value = firstNonEmpty(...aliases.map((alias) => merged[alias]));
        if (value) result[canonicalKey] = value;
    }

    // 2) Captura dinâmica: qualquer chave que pareça ser UTM/tracking e que
    //    ainda não tenhamos mapeado explicitamente (ex.: uma nova plataforma
    //    lançou um "xyzclid" e ninguém atualizou este arquivo ainda).
    for (const [key, rawValue] of Object.entries(merged)) {
        const lowerKey = key.toLowerCase();
        const looksLikeTracking =
            lowerKey.startsWith("utm_") ||
            lowerKey.endsWith("clid") ||
            lowerKey.endsWith("_id") ||
            lowerKey === "fbp" ||
            lowerKey === "fbc";

        if (!looksLikeTracking) continue;
        if (KNOWN_ALIASES.has(lowerKey)) continue; // já tratado acima

        const value = String(rawValue ?? "").trim();
        if (value) result[key] = value;
    }

    return result;
}

export default async function handler(req, res) {
    if (req.method !== "POST") {
        return res.status(405).json({
            error: "Method not allowed"
        });
    }
    try {
        const {
            amount,
            sessionId,
            personal,
            reward,
            utm
        } = req.body;

        const normalizedUtm = normalizeUtm(utm, req.body);

        // Log temporário para você confirmar em produção que os parâmetros
        // estão chegando preenchidos. Pode remover depois de validar.
        console.log("[pix/create] Tracking params recebidos:", {
            raw: utm,
            normalized: normalizedUtm
        });

        // Campos "core" que sabemos que o BravoPay espera (mantidos no
        // formato original para não quebrar o contrato já existente).
        // Tudo mais que foi capturado (utm_id, msclkid, twclid, etc.) vai
        // dentro de "extra", para não arriscar rejeição por campo
        // desconhecido caso o schema do BravoPay seja estrito.
        const coreKeys = ["source", "medium", "campaign", "content", "term", "fbclid", "ttclid", "gclid"];
        const core = {};
        for (const k of coreKeys) core[k] = normalizedUtm[k] || "";

        const extra = {};
        for (const [k, v] of Object.entries(normalizedUtm)) {
            if (!coreKeys.includes(k)) extra[k] = v;
        }

        const transaction = await bravopay("/transactions", {
            method: "POST",
            body: JSON.stringify({
                amount_cents: Math.round(Number(amount) * 100),
                method: "pix",
                product_id: process.env.BRAVOPAY_PRODUCT_ID,
                customer: {
                    name: personal?.name || "",
                    email: personal?.email || "",
                    cpf: String(personal?.cpf || "").replace(/\D/g, ""),
                    phone: String(personal?.phoneDigits || personal?.phone || "").replace(/\D/g, "")
                },
                description: reward?.name || "Pedido",
                external_reference: sessionId,
                utm: {
                    ...core,
                    ...(Object.keys(extra).length ? { extra } : {})
                }
            })
        });

        const {
            paymentCode,
            paymentQrUrl,
            paymentCodeBase64
        } = resolvePixVisualData(transaction);

        return res.status(200).json({
            success: true,
            idTransaction: transaction.id,
            txid: transaction.id,
            status: transaction.status,
            statusRaw: transaction.status,
            paymentCode,
            paymentQrUrl,
            paymentCodeBase64,
            pixCode: paymentCode,
            copyPaste: paymentCode,
            qrCode: paymentQrUrl || paymentCodeBase64,
            qrCodeBase64: paymentCodeBase64,
            amount: transaction.amount_cents / 100,
            amount_cents: transaction.amount_cents,
            expiresAt: transaction.pix?.expires_at || null,
            rewardId: reward?.id || "bag"
        });
    } catch (e) {
        console.error(e);
        return res.status(500).json({
            success: false,
            error:
                e?.error?.message ||
                e?.message ||
                "Erro ao gerar PIX"
        });
    }
}
