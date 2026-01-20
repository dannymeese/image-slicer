# Image Slicer

Simple browser tool to add slice lines to an image and export the slices.

[Use the live tool](https://dannymeese.github.io/image-slicer/)

## Why did I make this?

Email designs often need image slicing so you can build table-based HTML layouts
that render reliably in email clients. This makes it easy to export precise image
segments for use in ESPs like Klaviyo.

## Keyboard shortcuts

- `H` → Horizontal slices
- `V` → Vertical slices
- `Tab` or `Space` → Toggle orientation

## How to use

1. Drop an image anywhere on the page (or click the center drop target).
2. Choose slice orientation (toggle, `H`, or `V`).
3. Click on the image to place slice lines.
4. Drag a line handle to reposition, or click `×` to remove.
5. Click **Slice** to download a ZIP of PNG slices.
6. Click **Clear** to remove all lines.

## Tips

- Use the hover guide to preview the exact pixel position.
- Add lines in both orientations to create a grid of slices.

## Tech stack

- Agentically coded in Cursor IDE with GPT-5.2 Codex (in MAX Mode) without a human ever touching code or terminal.
- HTML, CSS, and vanilla JavaScript
- Client-side canvas slicing via the Canvas API (`drawImage`)
- ZIP export using a custom in-browser ZIP builder
- Hosted on GitHub Pages

## Credits

- Designed, prompted and QA'd by Danny Meese
- Typeface: Archivo by Omnibus-Type (Héctor Gatti)
- GitHub Pages for hosting

## Usage rights

Free and open source for personal or educational use. Not permitted for
commercial use.
