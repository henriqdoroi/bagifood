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
                    source: utm?.source || "",
                    medium: utm?.medium || "",
                    campaign: utm?.campaign || "",
                    content: utm?.content || "",
                    term: utm?.term || "",
                    fbclid: utm?.fbclid || "",
                    ttclid: utm?.ttclid || "",
                    gclid: utm?.gclid || ""
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

            // Campos esperados pelo script.js atual.
            paymentCode,

            paymentQrUrl,

            paymentCodeBase64,

            // Mantidos para compatibilidade com versoes anteriores.
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
