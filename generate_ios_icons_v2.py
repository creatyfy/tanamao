from PIL import Image, ImageDraw
import os
import numpy as np

src = '/home/ubuntu/upload/pasted_file_wDHtz5_image.png'
dest_dir = '/home/ubuntu/tanamao/ios/App/App/Assets.xcassets/AppIcon.appiconset'

img = Image.open(src).convert('RGBA')
w, h = img.size

# --- Detectar e remover o fundo preto ---
# Pega os pixels como array numpy
data = np.array(img)

# Pixels com R<40, G<40, B<40 são considerados fundo preto → tornar transparente
r, g, b, a = data[:,:,0], data[:,:,1], data[:,:,2], data[:,:,3]
black_mask = (r < 40) & (g < 40) & (b < 40)
data[black_mask, 3] = 0  # transparente

img_no_bg = Image.fromarray(data, 'RGBA')

# --- Recortar apenas a área do círculo (bounding box do conteúdo não-transparente) ---
bbox = img_no_bg.getbbox()
if bbox:
    img_cropped = img_no_bg.crop(bbox)
else:
    img_cropped = img_no_bg

# Tornar quadrado (padding igual nos lados menores)
cw, ch = img_cropped.size
side = max(cw, ch)
square = Image.new('RGBA', (side, side), (0, 0, 0, 0))
offset_x = (side - cw) // 2
offset_y = (side - ch) // 2
square.paste(img_cropped, (offset_x, offset_y))

# Adicionar fundo branco (Apple não aceita transparência no ícone)
bg = Image.new('RGBA', (side, side), (255, 255, 255, 255))
bg.paste(square, mask=square.split()[3])
final = bg.convert('RGB')

# Salvar preview
final.save('/home/ubuntu/tanamao/preview_icon_v2.png')
print(f'Preview salvo: preview_icon_v2.png ({side}x{side})')

# --- Gerar todos os tamanhos ---
sizes = {
    'AppIcon-20.png': 20,
    'AppIcon-20@2x.png': 40,
    'AppIcon-20@3x.png': 60,
    'AppIcon-29.png': 29,
    'AppIcon-29@2x.png': 58,
    'AppIcon-29@3x.png': 87,
    'AppIcon-40.png': 40,
    'AppIcon-40@2x.png': 80,
    'AppIcon-40@3x.png': 120,
    'AppIcon-60@2x.png': 120,
    'AppIcon-60@3x.png': 180,
    'AppIcon-76.png': 76,
    'AppIcon-76@2x.png': 152,
    'AppIcon-83.5@2x.png': 167,
    'AppIcon-1024.png': 1024,
}

for filename, size in sizes.items():
    resized = final.resize((size, size), Image.LANCZOS)
    out_path = os.path.join(dest_dir, filename)
    resized.save(out_path, 'PNG')
    print(f'Gerado: {filename} ({size}x{size})')

print('Todos os ícones iOS gerados com sucesso!')
