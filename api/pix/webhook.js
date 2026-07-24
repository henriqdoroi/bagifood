export default async function handler(req, res) {

    console.log(req.body);

    if (req.body.type === "transaction.paid") {

        console.log("Pagamento aprovado!");

        // Atualizar pedido
        // Liberar acesso
        // Enviar evento ao Meta
        // Enviar evento ao TikTok
    }

    return res.status(200).json({
        received: true
    });
}
