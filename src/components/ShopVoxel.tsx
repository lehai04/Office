import { EXTRA_VOXELS } from '../utils/shopVoxels';
import { useEffect, useRef } from 'react';
import artworkUrl from '../assets/office-shop-voxel.png?url';
import type { ShopItem } from '../utils/officeShop';

const tiles: Partial<Record<ShopItem, readonly [number, number, number, number]>> = {
  outfit: [542, 86, 234, 288],
  computer: [1032, 86, 240, 288],
  lamp: [1283, 86, 244, 288],
  incense: [542, 386, 234, 266],
  offering: [786, 386, 236, 266],
  plant: [542, 664, 234, 302],
  dance: [1032, 664, 240, 302],
  headstand: [1283, 664, 244, 302],
  hoodie: [786, 86, 236, 288],
  lotus: [1032, 386, 240, 266],
  tea: [1283, 386, 244, 266],
  headphones: [786, 664, 236, 302],
};

let artwork: Promise<HTMLImageElement> | undefined;
function loadArtwork() {
  artwork ??= new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = artworkUrl;
  });
  return artwork;
}

export function ShopVoxel({ item }: { item: ShopItem }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const tile = tiles[item];
  const [x, y, width, height] = tile ?? [0, 0, 240, 280];

  useEffect(() => {
    const context = canvas.current?.getContext('2d');
    if (!context) return;
    if (!tile) {
      context.clearRect(0, 0, width, height);
      const point = (x: number, y: number, z: number) => [120 + 69 * (x - z), 215 - 84 * y + 35 * (x + z)] as const;
      const face = (color: string, shade: string, corners: ReturnType<typeof point>[]) => {
        context.beginPath();
        corners.forEach((corner, i) => i ? context.lineTo(...corner) : context.moveTo(...corner));
        context.closePath();
        context.fillStyle = color;
        context.fill();
        context.fillStyle = shade;
        context.fill();
      };
      for (const [cx, cy, cz, w, h, d, color] of [...(EXTRA_VOXELS[item] ?? [])].sort((a, b) => a[0] + a[1] + a[2] - b[0] - b[1] - b[2])) {
        const x = cx - w / 2, y = cy - h / 2, z = cz - d / 2;
        const a = point(x, y + h, z), b = point(x + w, y + h, z), c = point(x + w, y + h, z + d), e = point(x, y + h, z + d);
        const front = point(x + w, y, z + d);
        face(color, '#29204840', [b, c, front, point(x + w, y, z)]);
        face(color, '#29204819', [e, c, front, point(x, y, z + d)]);
        face(color, '#ffffff32', [a, b, c, e]);
      }
      return;
    }
    let active = true;
    context.clearRect(0, 0, width, height);
    void loadArtwork().then((image) => {
      if (active) context.drawImage(image, x, y, width, height, 0, 0, width, height);
    }).catch(() => {});
    return () => { active = false; };
  }, [item, tile, x, y, width, height]);

  return <canvas ref={canvas} width={width} height={height} aria-hidden="true" className="h-full w-full object-contain" />;
}
