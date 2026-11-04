// AUTOSIZE: text boxes grow and shrink with the text, so the user never has to resize them.
// (The CSS also turns off the manual resize handle: see textarea.field in components.css.)
function fit(box) {
  box.style.height = 'auto';                                                // let the browser measure the text
  const borders = box.offsetHeight - box.clientHeight;                      // border thickness (box-sizing is border-box)
  box.style.height = box.scrollHeight + borders + 'px';                     // then set the height to fit it
}

export const autosizeAll = () => document.querySelectorAll('textarea').forEach(fit);

document.addEventListener('input', e => { if (e.target.matches('textarea')) fit(e.target); }); // while typing
addEventListener('resize', autosizeAll); // text wraps differently when the window width changes
