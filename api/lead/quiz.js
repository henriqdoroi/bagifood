import { ok, options } from "../_utils";

export default function handler(req, res) {

    if (options(req, res)) return;

    console.log("QUIZ");
    console.log(req.body);

    return ok(res);
}
