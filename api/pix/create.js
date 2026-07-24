import { bravopay } from "../_lib/bravopay.js";

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
            address,
            shipping,
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
                    phone: String(personal?.phone || "").replace(/\D/g, "")
                },

                description:
                    reward?.name ||
                    shipping?.name ||
                    "Pedido",

                external_reference:
                    sessionId ||
                    `order_${Date.now()}`,

                utm: {
                    source: utm?.source || "",
                    medium: utm?.medium || "",
                    campaign: utm?.campaign || "",
                    content: utm?.content || "",
                    term: utm?.term || "",
                    fbclid: utm?.fbclid || "",
                    ttclid: utm?.ttclid || "",
                    gclid: utm?.gclid || ""
                },

                metadata: {
                    address,
                    shipping,
                    reward
                }

            })

        });

        return res.status(200).json({

            success: true,

            txid: transaction.id,

            status: transaction.status,

            amount: transaction.amount_cents / 100,

            pixCode: transaction.pix?.copy_paste || "",

            expiresAt: transaction.pix?.expires_at || null,

            raw: transaction

        });

    } catch (e) {

        console.error(e);

        return res.status(500).json({
            success: false,
            error: e?.error?.message || e?.message || "Erro ao gerar PIX"
        });

    }

}
