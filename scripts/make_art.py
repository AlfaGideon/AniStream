#!/usr/bin/env python3
"""Генерация производных артов AniStream на Pillow:
1) hero-бэкдропы 16:9 = размытый фулблид + чёткий портрет по центру;
2) обложки манги = ч/б «тушь» с зерном из цветных постеров.
"""
from PIL import Image, ImageEnhance, ImageFilter, ImageOps, ImageDraw
import os

IMG = os.path.join(os.path.dirname(__file__), '..', 'public', 'img')

W, H = 1600, 900          # бэкдроп
CW, CH = 900, 1350        # обложка 2:3


def hero(src: str, dst: str) -> None:
    img = Image.open(os.path.join(IMG, src)).convert('RGB')

    # фон: cover 16:9 + сильный блюр + затемнение
    bg = ImageOps.fit(img, (W, H), Image.LANCZOS, centering=(0.5, 0.42))
    bg = bg.filter(ImageFilter.GaussianBlur(34))
    bg = ImageEnhance.Brightness(bg).enhance(0.5)
    bg = ImageEnhance.Color(bg).enhance(1.15)

    # передний план: портрет постера
    fh = H - 40
    fw = int(img.width * fh / img.height)
    fg = img.resize((fw, fh), Image.LANCZOS)

    # мягкая тень за портретом
    shadow = Image.new('RGBA', (fw + 120, fh + 60), (0, 0, 0, 0))
    d = ImageDraw.Draw(shadow)
    d.rounded_rectangle([40, 10, fw + 80, fh + 50], 24, fill=(0, 0, 0, 200))
    shadow = shadow.filter(ImageFilter.GaussianBlur(26))

    x = (W - fw) * 3 // 4  # портрет правее центра — слева место под текст
    bg = bg.convert('RGBA')
    bg.alpha_composite(shadow, (x - 40, (H - fh) // 2 - 10))
    bg.paste(fg, (x, (H - fh) // 2))

    # лёгкая виньетка слева под текст
    grad = Image.new('L', (W, 1), 0)
    for px in range(W):
        grad.putpixel((px, 0), max(0, 150 - int(px / W * 260)))
    vignette = Image.merge('RGBA', [(grad.resize((W, H)).point(lambda v: v))] * 3 + [grad.resize((W, H))])
    bg.alpha_composite(vignette)

    bg.convert('RGB').save(os.path.join(IMG, dst), quality=88)
    print('hero:', dst)


def ink(src: str, dst: str) -> None:
    img = Image.open(os.path.join(IMG, src)).convert('L')
    img = ImageOps.fit(img, (CW, CH), Image.LANCZOS, centering=(0.5, 0.4))
    img = ImageOps.autocontrast(img, cutoff=2)
    img = ImageEnhance.Contrast(img).enhance(1.35)
    img = img.filter(ImageFilter.UnsharpMask(radius=2, percent=130, threshold=3))

    # плёнка-зерно (скринтон)
    noise = Image.effect_noise((CW, CH), 22)
    img = Image.blend(img, noise, 0.07)

    # красный акцент: тонкая рамка как у тома манги
    rgb = Image.merge('RGB', (img, img, img))
    d = ImageDraw.Draw(rgb)
    d.rectangle([14, 14, CW - 14, CH - 14], outline=(180, 30, 40), width=6)
    d.rectangle([26, 26, CW - 26, CH - 26], outline=(235, 235, 235), width=2)

    rgb.save(os.path.join(IMG, dst), quality=90)
    print('manga:', dst)


if __name__ == '__main__':
    hero('p-aot.jpg', 'hero-aot.jpg')
    hero('p-frieren.jpg', 'hero-frieren.jpg')
    hero('p-jjk.jpg', 'hero-jjk.jpg')
    ink('p-aot.jpg', 'm-aot.jpg')
    ink('p-jjk.jpg', 'm-jjk.jpg')
    ink('p-frieren.jpg', 'm-frieren.jpg')
    print('done')
