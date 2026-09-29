import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { makeRoomCode, makeToken, saveHostToken } from "@/lib/karaoke";
import { createRoom as createRoomFn } from "@/lib/karaoke.functions";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Palco Neon — Karaokê coletivo com fila por QR code" },
      {
        name: "description",
        content:
          "Crie uma sala de karaokê, mostre o QR code na TV e deixe todo mundo escolher músicas do YouTube pelo celular.",
      },
      { property: "og:title", content: "Palco Neon — Karaokê coletivo" },
      {
        property: "og:description",
        content: "Crie uma sala, mostre o QR code e deixe a galera montar a fila pelo celular.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Index() {
  const navigate = useNavigate();
  const [roomName, setRoomName] = useState("");
  const [code, setCode] = useState("");
  const [creating, setCreating] = useState(false);

  async function createRoom() {
    setCreating(true);
    try {
      const token = makeToken();
      let attempt = 0;
      while (attempt < 5) {
        const newCode = makeRoomCode();
        const { error } = await supabase.from("rooms").insert({
          code: newCode,
          name: roomName.trim() || "Karaokê",
          host_token: token,
        });
        if (!error) {
          saveHostToken(newCode, token);
          navigate({ to: "/host/$code", params: { code: newCode } });
          return;
        }
        if (!error.message.includes("duplicate")) throw error;
        attempt++;
      }
      throw new Error("Não consegui gerar um código livre");
    } catch (error) {
      toast.error("Não foi possível criar a sala", {
        description: error instanceof Error ? error.message : undefined,
      });
    } finally {
      setCreating(false);
    }
  }

  function joinRoom() {
    const clean = code.trim().toUpperCase();
    if (clean.length < 4) {
      toast.error("Digite o código da sala");
      return;
    }
    navigate({ to: "/r/$code", params: { code: clean } });
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col items-center justify-center gap-10 px-5 py-16">
      <header className="text-center">
        <p className="text-sm font-semibold uppercase tracking-[0.35em] text-accent">
          Karaokê coletivo
        </p>
        <h1 className="mt-3 text-6xl leading-none sm:text-8xl">
          <span className="text-stage">Palco Neon</span>
        </h1>
        <p className="mx-auto mt-4 max-w-md text-muted-foreground">
          Qualquer vídeo do YouTube vira karaokê. O anfitrião abre a sala na TV, a galera entra pelo
          QR code e monta a fila do celular.
        </p>
      </header>

      <div className="grid w-full gap-5 sm:grid-cols-2">
        <section className="panel flex flex-col gap-4 p-6">
          <div>
            <h2 className="text-3xl">Sou o anfitrião</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Abra a sala na tela grande e mostre o QR code.
            </p>
          </div>
          <Input
            value={roomName}
            onChange={(e) => setRoomName(e.target.value)}
            placeholder="Nome da festa (opcional)"
            maxLength={40}
          />
          <Button className="btn-neon h-12 text-base font-bold" disabled={creating} onClick={createRoom}>
            {creating ? "Abrindo o palco..." : "Criar sala"}
          </Button>
        </section>

        <section className="panel flex flex-col gap-4 p-6">
          <div>
            <h2 className="text-3xl">Vou cantar</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Leia o QR code da TV ou digite o código da sala.
            </p>
          </div>
          <Input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="CÓDIGO"
            maxLength={8}
            className="text-center text-2xl font-bold tracking-[0.4em]"
          />
          <Button variant="secondary" className="h-12 text-base font-bold" onClick={joinRoom}>
            Entrar na sala
          </Button>
        </section>
      </div>
    </main>
  );
}
