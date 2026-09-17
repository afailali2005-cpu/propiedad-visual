import { createFileRoute } from "@tanstack/react-router";

/**
 * Webhook de Stripe: actualiza el plan del usuario cuando se confirma el pago.
 *
 * TODO: añadir STRIPE_WEBHOOK_SECRET y STRIPE_SECRET_KEY en Ajustes → Secretos
 * para activar la verificación de firma real.
 */
const PLAN_POR_PRECIO: Record<string, "starter" | "pro" | "agency"> = {
  // TODO: sustituir por los price IDs reales de Stripe.
  price_starter: "starter",
  price_pro: "pro",
  price_agency: "agency",
};

export const Route = createFileRoute("/api/public/stripe-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const cuerpo = await request.text();
        const firma = request.headers.get("stripe-signature");
        const secreto = process.env["STRIPE_WEBHOOK_SECRET"];

        if (!secreto) {
          return new Response(JSON.stringify({ error: "Webhook no configurado" }), {
            status: 503,
            headers: { "content-type": "application/json" },
          });
        }
        if (!firma) {
          return new Response("Firma ausente", { status: 401 });
        }

        let evento: any;
        try {
          evento = JSON.parse(cuerpo);
        } catch {
          return new Response("Cuerpo inválido", { status: 400 });
        }

        // TODO: verificar la firma con la librería oficial de Stripe antes de confiar en el evento.

        const tipos = ["checkout.session.completed", "customer.subscription.updated"];
        if (!tipos.includes(evento?.type)) {
          return new Response(JSON.stringify({ received: true }), {
            headers: { "content-type": "application/json" },
          });
        }

        const objeto = evento.data?.object ?? {};
        const customerId: string | undefined = objeto.customer;
        const priceId: string | undefined =
          objeto.items?.data?.[0]?.price?.id ?? objeto.metadata?.price_id;
        const userId: string | undefined = objeto.metadata?.user_id;
        const plan = priceId ? PLAN_POR_PRECIO[priceId] : undefined;

        if (!plan || (!customerId && !userId)) {
          return new Response(JSON.stringify({ received: true }), {
            headers: { "content-type": "application/json" },
          });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const inicio = new Date();
        inicio.setUTCDate(1);
        inicio.setUTCHours(0, 0, 0, 0);

        const query = supabaseAdmin
          .from("profiles")
          .update({
            plan,
            stripe_customer_id: customerId ?? null,
            videos_usados_mes: 0,
            tours_usados_mes: 0,
            periodo_inicio: inicio.toISOString(),
          });

        const { error } = userId
          ? await query.eq("id", userId)
          : await query.eq("stripe_customer_id", customerId!);

        if (error) {
          console.error("[stripe-webhook]", error.message);
          return new Response("Error actualizando el plan", { status: 500 });
        }

        return new Response(JSON.stringify({ received: true }), {
          headers: { "content-type": "application/json" },
        });
      },
    },
  },
});
