from PIL import Image
import os

# Logo original
src = '/home/ubuntu/upload/pasted_file_cLDX3H_image.png'
dest_dir = '/home/ubuntu/tanamao/ios/App/App/Assets.xcassets/AppIcon.appiconset'

img = Image.open(src).convert('RGBA')

# Criar fundo branco para remover transparência (Apple exige fundo sólido)
bg = Image.new('RGBA', img.size, (255, 255, 255, 255))
bg.paste(img, mask=img.split()[3])
img = bg.convert('RGB')

# Tamanhos exigidos pela Apple
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
    resized = img.resize((size, size), Image.LANCZOS)
    out_path = os.path.join(dest_dir, filename)
    resized.save(out_path, 'PNG')
    print(f'Gerado: {filename} ({size}x{size})')

print('Todos os ícones iOS gerados com sucesso!')
