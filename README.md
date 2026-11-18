# 📚 AI Study Buddy

Revising from long notes is slow and, honestly, a bit boring. So I made a small tool that does the boring part for you.

Paste your notes, and you get:
- a **short summary** of the key points
- a **mini quiz** with a live score and a little pep talk at the end
- **flip flashcards** to revise on the go

## Why it's nice to use
- No sign-up, no install. Just open `index.html`.
- Works **offline** out of the box.
- Want smarter, more natural questions? Add a free **Gemini API key** and it switches to AI mode.
- Dark mode and mobile friendly, because nobody studies only at a desk.
- Friendly messages instead of scary error popups.

## Tech
Plain HTML, CSS and JavaScript. No frameworks, no build step.

## Run it
1. Download or clone the repo
2. Open `index.html` in your browser
3. Click **Show me an example** to try it instantly

## How it works
- **Offline mode:** scores each sentence by how many important keywords it has, picks the top ones for the summary, and hides key terms to make fill-in-the-blank quiz questions.
- **AI mode:** sends your notes to Gemini and shows the quiz and flashcards it returns.
- Your API key is saved only in your own browser (localStorage). It is never sent anywhere except Google's API.

## What I'd add next
- PDF upload
- Spaced repetition for flashcards
- Export flashcards to Anki

Made with ☕ by Manan Sharma, ABES EC, for PromptWars x Agent X 2.0.
