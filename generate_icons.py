#!/usr/bin/env python3.11
"""
Gera todos os ícones Android e iOS a partir da nova logo do Tá Na Mão.
A logo tem fundo preto com círculo verde centralizado.
Vamos recortar apenas o círculo verde e usar como ícone.
"""
from PIL import Image, ImageDraw
import os
import math

# Carrega a imagem original
src = Image.open("/home/ubuntu/tanamao/logo_new.png").convert("RGBA")
w, h = src.size
print(f"Imagem original: {w}x{h}")

# A logo tem fundo preto com o círculo verde centralizado
# Vamos recortar a região do círculo (ele está centralizado horizontalmente)
# e tem um pouco de margem em cima e embaixo
# Analisando: 1024x1536, o círculo ocupa ~1024px de largura
# Centro vertical estimado: o círculo vai de ~y=120 até y=1140 (aprox)
# Vamos usar crop quadrado centrado no círculo

# Crop: pegar região quadrada centrada no círculo verde
# O círculo tem ~1000px de diâmetro, centrado em x=512, y=630 aprox
cx, cy = 512, 630
radius = 490

left = max(0, cx - radius)
top = max(0, cy - radius)
right = min(w, cx + radius)
bottom = min(h, cy + radius)

cropped = src.crop((left, top, right, bottom))
print(f"Recortado: {cropped.size}")

# Cria ícone quadrado com fundo branco (para Android) ou transparente (para iOS)
def make_icon(size, bg_color=(255, 255, 255, 255), circle_clip=False):
    """Gera ícone redimensionado. Se circle_clip=True, aplica máscara circular."""
    icon = cropped.resize((size, size), Image.LANCZOS)
    
    if circle_clip:
        # Aplica máscara circular
        mask = Image.new("L", (size, size), 0)
        draw = ImageDraw.Draw(mask)
        draw.ellipse((0, 0, size, size), fill=255)
        result = Image.new("RGBA", (size, size), (0, 0, 0, 0))
        result.paste(icon, mask=mask)
        return result
    else:
        # Fundo sólido
        result = Image.new("RGBA", (size, size), bg_color)
        result.paste(icon, (0, 0), icon if icon.mode == "RGBA" else None)
        return result

# =====================
# ANDROID ICONS
# =====================
android_sizes = {
    "mipmap-mdpi": 48,
    "mipmap-hdpi": 72,
    "mipmap-xhdpi": 96,
    "mipmap-xxhdpi": 144,
    "mipmap-xxxhdpi": 192,
}

android_base = "/home/ubuntu/tanamao/android/app/src/main/res"

for folder, size in android_sizes.items():
    path = os.path.join(android_base, folder)
    os.makedirs(path, exist_ok=True)
    
    # ic_launcher.png (fundo branco)
    icon = make_icon(size, bg_color=(255, 255, 255, 255))
    icon.convert("RGB").save(os.path.join(path, "ic_launcher.png"), "PNG")
    
    # ic_launcher_round.png (circular)
    icon_round = make_icon(size, circle_clip=True)
    # Salva com fundo branco para round também
    bg = Image.new("RGBA", (size, size), (255, 255, 255, 255))
    bg.paste(icon_round, mask=icon_round)
    bg.convert("RGB").save(os.path.join(path, "ic_launcher_round.png"), "PNG")
    
    # ic_launcher_foreground.png (sem fundo, para adaptive icons)
    icon_fg = make_icon(size, bg_color=(0, 0, 0, 0))
    icon_fg.save(os.path.join(path, "ic_launcher_foreground.png"), "PNG")
    
    print(f"Android {folder}: {size}x{size} ✓")

print("\nAndroid icons gerados!")

# =====================
# iOS ICONS
# =====================
# Capacitor 8 com SPM - ícones vão em ios/App/App/Assets.xcassets/AppIcon.appiconset/
ios_icon_dir = "/home/ubuntu/tanamao/ios/App/App/Assets.xcassets/AppIcon.appiconset"

# Se o diretório iOS não existe ainda, cria mesmo assim para o Codemagic usar
os.makedirs(ios_icon_dir, exist_ok=True)

ios_sizes = [
    # (nome_arquivo, tamanho_px)
    ("AppIcon-20@2x.png", 40),
    ("AppIcon-20@3x.png", 60),
    ("AppIcon-29@2x.png", 58),
    ("AppIcon-29@3x.png", 87),
    ("AppIcon-40@2x.png", 80),
    ("AppIcon-40@3x.png", 120),
    ("AppIcon-60@2x.png", 120),
    ("AppIcon-60@3x.png", 180),
    ("AppIcon-76.png", 76),
    ("AppIcon-76@2x.png", 152),
    ("AppIcon-83.5@2x.png", 167),
    ("AppIcon-1024.png", 1024),
    ("AppIcon-20.png", 20),
    ("AppIcon-29.png", 29),
    ("AppIcon-40.png", 40),
]

for filename, size in ios_sizes:
    # iOS não aceita transparência - fundo branco
    icon = make_icon(size, bg_color=(255, 255, 255, 255))
    icon.convert("RGB").save(os.path.join(ios_icon_dir, filename), "PNG")
    print(f"iOS {filename}: {size}x{size} ✓")

# Gera Contents.json para o AppIcon.appiconset
contents_json = '''{
  "images" : [
    {"idiom":"iphone","scale":"2x","size":"20x20","filename":"AppIcon-20@2x.png"},
    {"idiom":"iphone","scale":"3x","size":"20x20","filename":"AppIcon-20@3x.png"},
    {"idiom":"iphone","scale":"2x","size":"29x29","filename":"AppIcon-29@2x.png"},
    {"idiom":"iphone","scale":"3x","size":"29x29","filename":"AppIcon-29@3x.png"},
    {"idiom":"iphone","scale":"2x","size":"40x40","filename":"AppIcon-40@2x.png"},
    {"idiom":"iphone","scale":"3x","size":"40x40","filename":"AppIcon-40@3x.png"},
    {"idiom":"iphone","scale":"2x","size":"60x60","filename":"AppIcon-60@2x.png"},
    {"idiom":"iphone","scale":"3x","size":"60x60","filename":"AppIcon-60@3x.png"},
    {"idiom":"ipad","scale":"1x","size":"20x20","filename":"AppIcon-20.png"},
    {"idiom":"ipad","scale":"2x","size":"20x20","filename":"AppIcon-20@2x.png"},
    {"idiom":"ipad","scale":"1x","size":"29x29","filename":"AppIcon-29.png"},
    {"idiom":"ipad","scale":"2x","size":"29x29","filename":"AppIcon-29@2x.png"},
    {"idiom":"ipad","scale":"1x","size":"40x40","filename":"AppIcon-40.png"},
    {"idiom":"ipad","scale":"2x","size":"40x40","filename":"AppIcon-40@2x.png"},
    {"idiom":"ipad","scale":"1x","size":"76x76","filename":"AppIcon-76.png"},
    {"idiom":"ipad","scale":"2x","size":"76x76","filename":"AppIcon-76@2x.png"},
    {"idiom":"ipad","scale":"2x","size":"83.5x83.5","filename":"AppIcon-83.5@2x.png"},
    {"idiom":"ios-marketing","scale":"1x","size":"1024x1024","filename":"AppIcon-1024.png"}
  ],
  "info" : {"author":"xcode","version":1}
}
'''

with open(os.path.join(ios_icon_dir, "Contents.json"), "w") as f:
    f.write(contents_json)

print("\niOS icons gerados!")
print("\nTodos os ícones gerados com sucesso!")
