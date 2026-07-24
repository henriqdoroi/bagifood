import { ok, options } from "../_utils";

export default function handler(req, res) {

    if (options(req, res)) return;

    console.log("TRACK");
    console.log(req.body);

    return ok(res);
}
