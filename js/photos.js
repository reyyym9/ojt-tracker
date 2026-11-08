// PHOTOS: the photo picker used by Log today and Edit day.
// Adding a photo compresses it and stores it right away; the day only remembers the ids
// when the form is submitted (so photos you never submit are cleaned up later by pruneImages).
import { $, esc } from './util.js';
import { compress, saveImage, getImage } from './images.js';

export function setupPhotos(startIds) {
  let ids = [...startIds];
  let urls = [];
  const grid = $('[data-bind="photos"]'), input = $('#photo-input');

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
        picture = `<img src="${url}" alt="${esc(record.name)}">`;
      }
      return `<figure class="photo">${picture}
        <button class="photo-remove" type="button" data-photo="${esc(id)}" aria-label="Remove photo">&times;</button></figure>`;
    }).join('');
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
    render();
  });

  render();
  return { getIds: () => [...ids] };
}
