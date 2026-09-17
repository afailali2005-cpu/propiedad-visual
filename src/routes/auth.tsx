import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { lovable } from "@/integrations/lovable/index";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Entrar en Habitour" },
      { name: "description", content: "Accede a tu cuenta de Habitour para crear vídeos y tours 3D." },
      { property: "og:title", content: "Entrar en Habitour" },
      { property: "og:description", content: "Accede a tu cuenta de Habitour." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [modo, setModo] = useState<"entrar" | "registro">("entrar");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [nombre, setNombre] = useState("");
  const [cargando, setCargando] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/app/proyectos" });
    });
  }, [navigate]);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setCargando(true);
    try {
      if (modo === "registro") {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/app/proyectos`,
            data: { nombre },
          },
        });
        if (error) throw error;
        if (!data.session) {
          toast.success("Revisa tu correo para confirmar la cuenta.");
          return;
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
      navigate({ to: "/app/proyectos" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No hemos podido completar la operación.");
    } finally {
      setCargando(false);
    }
  }

  async function google() {
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (result.error) {
      toast.error("No hemos podido iniciar sesión con Google.");
      return;
    }
    if (result.redirected) return;
    navigate({ to: "/app/proyectos" });
  }

  return (
    <div className="flex min-h-screen flex-col bg-sand">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-5 py-6">
        <Logo />
        <Link to="/" className="text-sm text-muted-foreground hover:text-foreground">
          Volver a la web
        </Link>
      </div>
      <div className="flex flex-1 items-start justify-center px-5 pb-16">
        <div className="surface-card w-full max-w-md p-7">
          <h1 className="text-2xl">
            {modo === "entrar" ? "Entra en tu cuenta" : "Crea tu cuenta"}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Genera vídeos y tours 3D para tus anuncios en minutos.
          </p>

          <Button variant="soft" className="mt-6 w-full" size="lg" onClick={google} type="button">
            Continuar con Google
          </Button>

          <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground">
            <span className="h-px flex-1 bg-border" /> o con tu email
            <span className="h-px flex-1 bg-border" />
          </div>

          <form onSubmit={enviar} className="space-y-4">
            {modo === "registro" && (
              <div>
                <Label htmlFor="nombre">Nombre</Label>
                <Input
                  id="nombre"
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  placeholder="Ana Martínez"
                  className="mt-1.5"
                />
              </div>
            )}
            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="tu@inmobiliaria.com"
                className="mt-1.5"
              />
            </div>
            <div>
              <Label htmlFor="password">Contraseña</Label>
              <Input
                id="password"
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1.5"
              />
            </div>
            <Button type="submit" variant="clay" size="lg" className="w-full" disabled={cargando}>
              {cargando ? "Un momento…" : modo === "entrar" ? "Entrar" : "Crear cuenta"}
            </Button>
          </form>

          <button
            type="button"
            onClick={() => setModo(modo === "entrar" ? "registro" : "entrar")}
            className="mt-5 w-full text-sm text-muted-foreground hover:text-foreground"
          >
            {modo === "entrar"
              ? "¿No tienes cuenta? Crear una"
              : "¿Ya tienes cuenta? Entrar"}
          </button>
        </div>
      </div>
    </div>
  );
}
