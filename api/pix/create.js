import { bravopay } from "../_lib/bravopay.js";

export default async function handler(req, res) {

    if (req.method !== "POST") {
        return res.status(405).json({
            error: "Method not allowed"
        });
    }

    try {

        const {

            amount_cents,

            product_id,

            customer,

            description,

            external_reference,

            utm

        } = req.body;

        const transaction = await bravopay("/transactions", {

            method: "POST",

            body: JSON.stringify({

                amount_cents,

                method: "pix",

                product_id,

                customer,

                description,

                external_reference,

                utm

            })

        });

        return res.status(200).json(transaction);

    } catch (e) {

        return res.status(500).json(e);

    }

}
