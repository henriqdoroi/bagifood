import { bravopay } from "../_lib/bravopay.js";

export default async function handler(req, res) {

    try {

        const { id } = req.query;

        const tx = await bravopay(`/transactions/${id}`);

        res.status(200).json(tx);

    } catch (e) {

        res.status(500).json(e);

    }

}
