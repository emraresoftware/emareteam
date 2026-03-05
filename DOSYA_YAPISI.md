# 📁 Emare Team — Dosya Yapısı

> **Oluşturulma:** Otomatik  
> **Amaç:** Yapay zekalar kod yazmadan önce mevcut dosya yapısını incelemeli

---

## Proje Dosya Ağacı

```
/Users/emre/Desktop/Emare/emareteam
├── EMARE_AI_COLLECTIVE.md
├── EMARE_ORTAK_CALISMA -> /Users/emre/Desktop/Emare/EMARE_ORTAK_CALISMA
├── EMARE_ORTAK_HAFIZA.md
├── app.py
├── emare_team_hafiza.md
├── instance
│   └── ekip.db
├── requirements.txt
├── start.sh
├── static
│   ├── app.js
│   └── style.css
└── templates
    └── index.html

5 directories, 10 files

```

---

## 📌 Kullanım Talimatları (AI İçin)

Bu dosya, kod üretmeden önce projenin mevcut yapısını kontrol etmek içindir:

1. **Yeni dosya oluşturmadan önce:** Bu ağaçta benzer bir dosya var mı kontrol et
2. **Yeni klasör oluşturmadan önce:** Mevcut klasör yapısına uygun mu kontrol et
3. **Import/require yapmadan önce:** Dosya yolu doğru mu kontrol et
4. **Kod kopyalamadan önce:** Aynı fonksiyon başka dosyada var mı kontrol et

**Örnek:**
- ❌ "Yeni bir auth.py oluşturalım" → ✅ Kontrol et, zaten `app/auth.py` var mı?
- ❌ "config/ klasörü oluşturalım" → ✅ Kontrol et, zaten `config/` var mı?
- ❌ `from utils import helper` → ✅ Kontrol et, `utils/helper.py` gerçekten var mı?

---

**Not:** Bu dosya otomatik oluşturulmuştur. Proje yapısı değiştikçe güncellenmelidir.

```bash
# Güncelleme komutu
python3 /Users/emre/Desktop/Emare/create_dosya_yapisi.py
```
