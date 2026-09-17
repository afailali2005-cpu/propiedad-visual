import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";

export function Waitlist() {
  const [email, setEmail] = useState("");
  const [enviando, setEnviando] = useState(false);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    if (!email.includes("@")) {
      toast.error("Escribe un email válido.");
      return;
    }
    setEnviando(true);
    const { error } = await supabase.from("waitlist").insert({ email: email.trim().toLowerCase() });
    setEnviando(false);

    if (error) {
      if (error.code === "23505") {
        toast.success("Ya estabas apuntado. ¡Te avisamos pronto!");
        setEmail("");
        return;
      }
      toast.error("No hemos podido guardar tu email. Inténtalo de nuevo.");
      return;
    }
    toast.success("¡Listo! Te escribiremos en cuanto abramos plazas.");
    setEmail("");
  }

  return (
    <form onSubmit={enviar} className="flex w-full max-w-md flex-col gap-2 sm:flex-row">
      <Input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="tu@inmobiliaria.com"
        aria-label="Email"
        className="bg-background/10 text-forest-foreground placeholder:text-forest-foreground/50"
      />
      <Button type="submit" variant="clay" disabled={enviando}>
        {enviando ? "Enviando…" : "Apuntarme"}
      </Button>
    </form>
  );
}
