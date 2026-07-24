import { bravopay } from "../_lib/bravopay.js";

export default async function handler(req, res) {

    try {

        const { id } = req.query;

        const tx = await bravopay(`/transactions/${id}`);

        return res.status(200).json({

            success: true,

            idTransaction: tx.id,

            txid: tx.id,

            status: tx.status,

            statusRaw: tx.status,

            paid: String(tx.status).toUpperCase() === "PAID",

            pixCode: tx.pix?.copy_paste || "",

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
