import { ok, options } from "../_utils";

export default function handler(req, res) {

    if (options(req, res)) return;

    console.log("ORDERBUMP");
    console.log(req.body);

    return ok(res);
}
