import { ok, options } from "../_utils";

export default function handler(req, res) {

    if (options(req, res)) return;

    console.log("EVENT");
    console.log(req.body);

    return ok(res);
}
