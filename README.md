# Sing Along Live

me ajude a criar um sistema de karaoke online, a ideia é que qualquer video possa ser usado como um karaoke, existirá um anfitriao onde as outras pessoas vão se cnectar através de leitura de qr code, escolher suas musicas e jogar na sequencia para que seja reproduzida como próxima na fila, para escolha de musicas poderá ser uma musica já enviada antes pelo link do youtube, ou uma nova musica inserindo o link

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://my-digital-karaoke.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/d8c94f4a-c6f2-4f3a-90cb-6d551a48b0e4).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```


## Deploy com PostgreSQL puro no EasyPanel

O projeto não depende mais do Supabase. O banco é PostgreSQL e o acesso é feito no servidor pelo TanStack Start + Drizzle ORM + postgres.js.

No EasyPanel, crie um serviço PostgreSQL e configure no serviço da aplicação:

    DATABASE_URL=postgresql://usuario:senha@postgres:5432/my_digital_karaoke
    DB_POOL_SIZE=10

O container executa as migrations antes de iniciar a aplicação. A porta interna da aplicação é 3000.

A migration inicial está em drizzle/migrations/0001_postgresql_puro.sql.
