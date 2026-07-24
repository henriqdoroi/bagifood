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

    if (req.method !== "POST" && req.method !== "GET") {
        return res.status(405).json({
            error: "Method not allowed"
        });
    }

    try {

        // O frontend envia POST com { txid }. GET com ?id= continua funcionando.
        const id = firstNonEmpty(
            req.body?.txid,
            req.body?.id,
            req.query?.txid,
            req.query?.id
        );

        if (!id) {
            return res.status(400).json({
                success: false,
                error: "ID da transacao nao informado"
            });
        }

        const tx = await bravopay(`/transactions/${encodeURIComponent(id)}`);
        const {
            paymentCode,
            paymentQrUrl,
            paymentCodeBase64
        } = resolvePixVisualData(tx);

        return res.status(200).json({

            success: true,

            idTransaction: tx.id,

            txid: tx.id,

            status: tx.status,

            statusRaw: tx.status,

            paid: String(tx.status).toUpperCase() === "PAID",

            // Campos esperados pelo script.js atual.
            paymentCode,

            paymentQrUrl,

            paymentCodeBase64,

            // Mantidos para compatibilidade com versoes anteriores.
            pixCode: paymentCode,

            copyPaste: paymentCode,

            qrCode: paymentQrUrl || paymentCodeBase64,

            qrCodeBase64: paymentCodeBase64,

            amount: tx.amount_cents / 100,

            amount_cents: tx.amount_cents

        });

    } catch (e) {

        console.error(e);

        return res.status(500).json({
            success: false,
            error:
                e?.error?.message ||
                e?.message ||
                "Erro ao consultar pagamento"
        });

    }

}
