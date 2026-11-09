// PHOTOS: the photo picker used by Log today and Edit day.
// Adding a photo compresses it and stores it right away; the day only remembers the ids and descriptions
// when the form is submitted (so photos you never submit are cleaned up later by pruneImages).
import { $, esc } from './util.js';
import { compress, saveImage, getImage } from './images.js';
import { autosizeAll } from './autosize.js';

export function setupPhotos(startIds, startCaptions = {}) {
  let ids = [...startIds];
  let urls = [];
  const captions = { ...startCaptions }; // photo id -> description (optional)
  const grid = $('[data-bind="photos"]'), input = $('#photo-input');
  grid.classList.add('photo-grid-captions');

  async function render() {
    urls.forEach(url => URL.revokeObjectURL(url)); // free the memory of the old thumbnails
    urls = [];
    const records = await Promise.all(ids.map(id => getImage(id)));
    grid.innerHTML = ids.map((id, i) => {
      const record = records[i];
      let picture = '<span class="photo-missing">Photo not available yet</span>';
      if (record) {
        const url = URL.createObjectURL(record.blob);
        urls.push(url);
        picture = `<img src="${url}" alt="${esc(captions[id] || record.name)}">`;
      }
      return `<figure class="photo">${picture}
        <button class="photo-remove" type="button" data-photo="${esc(id)}" aria-label="Remove photo">&times;</button>
        <textarea class="field photo-caption" rows="2" maxlength="300" data-caption="${esc(id)}" placeholder="Add a description (optional)" aria-label="Photo description">${esc(captions[id] || '')}</textarea></figure>`;
    }).join('');
    autosizeAll(); // fit the boxes to any saved description
  }

  input.addEventListener('change', async () => {
    for (const file of input.files) {
      try { ids.push(await saveImage(await compress(file), file.name)); }
      catch (e) { alert(`Could not add "${file.name}". Try another picture.`); }
    }
    input.value = ''; // lets you pick the same picture again
    render();
  });

  grid.addEventListener('click', e => {
    const button = e.target.closest('[data-photo]');
    if (!button) return;
    ids = ids.filter(id => id !== button.dataset.photo); // removed from this day when you submit
    delete captions[button.dataset.photo];
    render();
  });

  // Remember each description as it is typed, so adding or removing another photo keeps it
  grid.addEventListener('input', e => {
    const box = e.target.closest('[data-caption]');
    if (box) captions[box.dataset.caption] = box.value;
  });

  render();
  return {
    getIds: () => [...ids],
    getCaptions: () => Object.fromEntries(ids.filter(id => (captions[id] || '').trim()).map(id => [id, captions[id].trim()])),
  };
}
