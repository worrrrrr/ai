# sv

Everything you need to build a Svelte project, powered by [`sv`](https://github.com/sveltejs/cli).

## Creating a project

If you're seeing this, you've probably already done this step. Congrats!

```sh
# create a new project
npx sv create my-app
```

To recreate this project with the same configuration:

```sh
# recreate this project
<<<<<<< HEAD
pnpm dlx sv@1.1.1 create --template minimal --types ts --add prettier tailwindcss="plugins:none" enhanced-img sveltekit-adapter="adapter:cloudflare+cfTarget:workers" --install pnpm ./
=======
pnpm dlx sv@1.1.1 create --template minimal --types ts --add tailwindcss="plugins:none" sveltekit-adapter="adapter:cloudflare+cfTarget:workers" enhanced-img prettier --install pnpm ./
>>>>>>> f9cfb12f8bd2928b2632b8fcdb7c608fd60c9727
```

## Adding features

Add features to your project with `sv add`:

```sh
npx sv add
```

For example, to add Tailwind CSS:

```sh
npx sv add tailwindcss
```

## Developing

Once you've created a project and installed dependencies with `npm install` (or `pnpm install` or `yarn`), start a development server:

```sh
npm run dev

# or start the server and open the app in a new browser tab
npm run dev -- --open
```

## Building

To create a production version of your app:

```sh
npm run build
```

You can preview the production build with `npm run preview`.
