import { cardTable } from '../data/cardTableData';

const images = import.meta.glob<string>('./move-card-faces/A*.webp', {
  eager: true,
  import: 'default',
  query: '?url',
});

export const moveCardFaces = new Map<string, string>();
for (const [uid, id] of Object.entries(cardTable.uids)) {
  const image = images[`./move-card-faces/${uid}.webp`];
  if (image) moveCardFaces.set(id, image);
}
