# 🧠 Emare Team Hafıza Dosyası

> 🔗 **Ortak Hafıza:** [`EMARE_ORTAK_HAFIZA.md`](/Users/emre/Desktop/Emare/EMARE_ORTAK_HAFIZA.md) — Tüm Emare ekosistemi, sunucu bilgileri, standartlar ve proje envanteri için bak.

> Son güncelleme: 3 Mart 2026  
> Bu dosya projenin tamamını belgeler. Nerede kaldığını, neyin ne olduğunu, hangi dosyanın ne işe yaradığını buradan okuyabilirsin.

---

## 📌 Proje Nedir?

**Emare Ekip Yönetici** — Emare ekibinin tüm yazılım projelerini tek bir yerden yönetmesi için geliştirilmiş, tamamen özel, web tabanlı bir **ekip & proje yönetim uygulamasıdır.**

- Python / Flask backend
- Vanilla JS + HTML/CSS frontend (hiç framework yok, saf SPA)
- SQLite veritabanı (Flask-SQLAlchemy üzerinden)
- **Tek sunucu, tek port: `http://localhost:5050`**
- macOS masaüstünde çalışır, tamamen yerel (internet gerektirmez)

---

## 📂 Proje Dizin Yapısı

```
/Users/emre/Desktop/ekip-yonetici/
│
├── app.py                  ← Tüm backend (Flask API + modeller + seed data)
├── requirements.txt        ← Bağımlılıklar: flask==3.1.0, flask-sqlalchemy==3.1.1
├── start.sh                ← Tek tıkla başlatma scripti
├── emare_team_hafiza.md    ← BU DOSYA — proje hafızası
│
├── instance/
│   └── ekip.db             ← SQLite veritabanı (otomatik oluşur)
│
├── static/
│   ├── app.js              ← Tüm frontend JavaScript (~1425 satır)
│   └── style.css           ← Tüm CSS (~1055 satır)
│
└── templates/
    └── index.html          ← Tek HTML sayfası (SPA shell, ~368 satır)
```

---

## 🚀 Nasıl Başlatılır?

### Yöntem 1 — Shell script (önerilen)
```bash
cd /Users/emre/Desktop/ekip-yonetici
./start.sh
```
Script sırasıyla şunları yapar:
1. `.venv` sanal ortamı yoksa oluşturur
2. `pip install -r requirements.txt` çalıştırır
3. `python app.py` ile sunucuyu başlatır
4. `http://localhost:5050` açılır

### Yöntem 2 — Manuel
```bash
cd /Users/emre/Desktop/ekip-yonetici
source .venv/bin/activate
python app.py
```

### Mevcut Ortam
- `.venv` sanal ortamı zaten kurulu ve aktif
- Python 3.x (`python3`)
- Port: **5050**

---

## 🗄️ Veritabanı Modelleri (app.py)

### `Project` — Proje
| Alan | Tür | Açıklama |
|------|-----|----------|
| `id` | Integer PK | Otomatik |
| `name` | String(100) | Proje adı |
| `code` | String(20) UNIQUE | Kısa kod (FIN, AST, vb.) |
| `icon` | String(10) | Emoji ikon |
| `color` | String(7) | Hex renk kodu |
| `description` | Text | Proje açıklaması |
| `path` | String(500) | Disk üzerinde proje dizini (opsiyonel) |

İlişkiler: `teams`, `tasks`, `messages` (CASCADE DELETE ile)

---

### `Team` — Takım
| Alan | Tür | Açıklama |
|------|-----|----------|
| `id` | Integer PK | Otomatik |
| `name` | String(100) | Takım adı |
| `project_id` | FK → Project | Hangi projeye ait |

İlişki: `members` (CASCADE DELETE)

---

### `Member` — Üye
| Alan | Tür | Açıklama |
|------|-----|----------|
| `id` | Integer PK | Otomatik |
| `name` | String(100) | Ad soyad |
| `role` | String(100) | Rol (Takım Lideri, Geliştirici, vb.) |
| `team_id` | FK → Team | Hangi takımda |
| `avatar_color` | String(7) | Hex renk (avatar için) |
| `is_online` | Boolean | Online durumu |

---

### `Task` — Görev
| Alan | Tür | Açıklama |
|------|-----|----------|
| `id` | Integer PK | Otomatik |
| `title` | String(200) | Görev başlığı |
| `description` | Text | Detay |
| `project_id` | FK → Project | Hangi projede |
| `assigned_to` | FK → Member (nullable) | Atanan kişi |
| `status` | String(20) | `yeni` / `devam` / `inceleme` / `tamamlandi` |
| `priority` | String(10) | `dusuk` / `orta` / `yuksek` / `acil` |
| `deadline` | DateTime (nullable) | Son tarih |
| `created_at` | DateTime | Oluşturulma |
| `updated_at` | DateTime | Son güncelleme |

---

### `Message` — Mesaj / Akış Kaydı
| Alan | Tür | Açıklama |
|------|-----|----------|
| `id` | Integer PK | Otomatik |
| `content` | Text | Mesaj içeriği |
| `project_id` | FK → Project | Hangi proje odasında |
| `sender_name` | String(100) | Gönderen (default: 'Emre') |
| `msg_type` | String(20) | `text` / `task` / `status` / `system` |
| `task_id` | FK → Task (nullable) | İlgili görev |
| `created_at` | DateTime | Zaman damgası |

---

## 🔌 Tüm API Endpoint'leri (app.py)

### Projeler
| Method | URL | İşlev |
|--------|-----|-------|
| GET | `/api/projects` | Tüm projeleri listele |
| POST | `/api/projects` | Proje oluştur |
| PATCH | `/api/projects/<pid>` | Projeyi güncelle |
| DELETE | `/api/projects/<pid>` | Projeyi sil (CASCADE) |

#### POST `/api/projects` payload:
```json
{
  "name": "Proje Adı",
  "code": "KOD",
  "icon": "📦",
  "color": "#6366f1",
  "description": "Açıklama",
  "path": "/Users/emre/Desktop/proje-dizini",
  "teams": ["Backend Takımı", "Frontend Takımı"]
}
```

---

### Takımlar
| Method | URL | İşlev |
|--------|-----|-------|
| GET | `/api/projects/<pid>/teams` | Projenin takımlarını getir |
| POST | `/api/projects/<pid>/teams` | Yeni takım oluştur |

---

### Üyeler
| Method | URL | İşlev |
|--------|-----|-------|
| POST | `/api/teams/<tid>/members` | Takıma üye ekle |
| PATCH | `/api/members/<mid>` | Üyeyi güncelle |
| DELETE | `/api/members/<mid>` | Üyeyi sil |

---

### Görevler
| Method | URL | İşlev |
|--------|-----|-------|
| GET | `/api/projects/<pid>/tasks` | Proje görevlerini listele (`?status=yeni` filtresi var) |
| POST | `/api/projects/<pid>/tasks` | Yeni görev oluştur |
| PATCH | `/api/tasks/<tid>` | Görevi güncelle (durum, atama, öncelik, vb.) |
| DELETE | `/api/tasks/<tid>` | Görevi sil |

Status değişince otomatik olarak projenin akışına `Sistem` mesajı düşer.

---

### Mesajlar / Akış
| Method | URL | İşlev |
|--------|-----|-------|
| GET | `/api/projects/<pid>/feed` | Proje akışını getir (`?after=<id>` ile polling) |
| POST | `/api/projects/<pid>/messages` | Mesaj gönder |

Polling mantığı: Frontend her 3 saniyede `?after=<lastMsgId>` ile yeni mesajları çeker.

---

### İstatistikler
| Method | URL | İşlev |
|--------|-----|-------|
| GET | `/api/stats` | Genel istatistikler (toplam görev, üye, proje bazlı özet) |

---

### Dosya Yönetimi API'si
| Method | URL | İşlev |
|--------|-----|-------|
| GET | `/api/projects/<pid>/files` | Klasör içeriğini listele (`?path=rel/yol`) |
| GET | `/api/projects/<pid>/file` | Dosya içeriğini oku (`?path=dosya.py`) |
| POST | `/api/projects/<pid>/file` | Dosya/klasör oluştur |
| PUT | `/api/projects/<pid>/file` | Dosya içeriğini kaydet |
| DELETE | `/api/projects/<pid>/file` | Dosya/klasör sil |
| GET | `/api/projects/<pid>/file/download` | Dosyayı indir |
| GET | `/api/projects/<pid>/search-files` | Dosya adına göre arama (`?q=arama`) |
| POST | `/api/files/share` | Dosyayı başka projeye kopyala |

**Güvenlik:** Path traversal koruması var (`_safe_path` fonksiyonu).  
**Max okuma:** 500KB per dosya.  
**İzin verilen text uzantıları:** .py, .js, .ts, .jsx, .tsx, .html, .css, .scss, .json, .yml, .yaml, .md, .txt, .sh, .sql, .xml, .csv, .ini, .cfg, .conf, .toml, .php, .vue, .rb, .go, .rs, .c, .java, .kt, .swift, .mdc, .log + daha fazlası.  
**Gizlenen dizinler:** .git, node_modules, \_\_pycache\_\_, .venv, vendor, .DS_Store, .idea, .vscode, .cursor, instance, storage/framework, bootstrap/cache.

---

## 🖥️ Frontend Mimarisi (static/app.js)

Tamamen **Vanilla JS** — hiç framework yok. Üç ana nesne vardır:

### `App` objesi (ana SPA)
Ana state yöneticisi ve render motoru.

**State:**
```javascript
App.state = {
  projects: [],          // Tüm projeler
  currentProject: null,  // Seçili proje
  messages: [],          // Aktif projenin mesajları
  tasks: [],             // Aktif projenin görevleri
  teams: [],             // Aktif projenin takımları
  allMembers: [],        // Tüm üyeler (flat liste)
  view: 'chat',          // Aktif view: chat|dosyalar|gorevler|ekip|pano
  sidebarOpen: false,
  teamPanelOpen: false,
  pollTimer: null,       // Polling interval handle
  lastMsgId: 0,          // Son alınan mesaj ID (polling için)
  taskFilter: 'all',     // Görev filtresi
  stats: null,           // İstatistik cache
}
```

**Önemli metodlar:**
- `App.init()` — Sayfa yüklenince çalışır
- `App.api(method, url, body)` — Tüm HTTP istekleri buradan geçer
- `App.selectProject(pid)` — Proje seçimi, view yenileme, polling başlatma
- `App.showView(view)` — Aktif view'ı değiştirir (chat/dosyalar/gorevler/ekip/pano)
- `App.pollFeed()` — 3 saniyede bir yeni mesaj çeker
- `App.sendMessage()` — Chat mesajı gönderir
- `App.showTaskModal()` / `App.hideTaskModal()` — Görev oluşturma modalı
- `App.createTask(event)` — Görev kaydetme
- `App.openEditTask(tid)` / `App.saveEditTask()` — Görev düzenleme
- `App.quickStatus(tid, status)` — Tek tıkla durum değiştirme
- `App.showAddMember(teamId)` / `App.saveMember()` — Üye ekleme/düzenleme
- `App.removeMember(mid)` — Üye silme
- `App.toggleSidebar()` / `App.toggleTeamPanel()` — Panel açma/kapama
- `App.renderSidebar()` — Sol panel yenileme
- `App.toast(msg, type)` — Bildirim toastı

---

### `Files` objesi (dosya yöneticisi)
Proje dizinini gezen, dosya okuyan, düzenleyen, silen ve paylaşan modül.

**Önemli metodlar:**
- `Files.render()` — Dosya gezgini view'ını çizer
- `Files.loadDir(path)` — Klasör içeriğini yükler
- `Files.openFile(path)` — Dosyayı açar, modal'da gösterir
- `Files.toggleEdit()` — Görüntüleme ↔ düzenleme modu
- `Files.saveFile()` — Değişiklikleri kaydeder (PUT endpoint)
- `Files.downloadFile()` — Dosyayı indirir
- `Files.showNewFileModal(isDir)` — Yeni dosya/klasör oluşturma
- `Files.createItem(event)` — Dosya/klasör oluşturur
- `Files.deleteItem(path)` — Siler
- `Files.showShareModal()` — Başka projeye paylaşma modalı
- `Files.shareFile(event)` — Kopyalama işlemi
- `Files.searchFiles(q)` — Dosya adı arama

---

### `ProjectMgr` objesi (proje yöneticisi)
Proje ekleme, düzenleme, silme işlemleri.

**Önemli metodlar:**
- `ProjectMgr.showCreate()` — Yeni proje modalı
- `ProjectMgr.showEdit(pid)` — Var olan projeyi düzenleme
- `ProjectMgr.save(event)` — Kaydet (POST veya PATCH)
- `ProjectMgr.deleteProject()` — Projeyi sil
- `ProjectMgr.closeModal()` — Modalı kapat
- `ProjectMgr.pickIcon(el)` — İkon seçimi
- `ProjectMgr.pickColor(el)` — Renk seçimi

---

## 📱 UI Yapısı (templates/index.html + static/style.css)

### Layout
```
┌─────────────────────────────────────────┐
│  Sidebar (sol)  │  Main Content (sağ)   │
│  ─────────────  │  ──────────────────── │
│  Logo + Başlık  │  Topbar               │
│  Proje Listesi  │  Content Area         │
│  + Pano butonu  │  Chat Input (altta)   │
└─────────────────┘──────────────────────┘
                     Bottom Nav (mobil)
                     Team Panel (sağ panel, toggle)
```

### 5 Ana View (Tab)
| View | İkon | Ne gösterir |
|------|------|-------------|
| `chat` | 💬 | Proje sohbet akışı, mesajlaşma, görev kartları inline |
| `dosyalar` | 📁 | Disk dosya gezgini (proje `path` ayarlıysa) |
| `gorevler` | 📋 | Kanban/liste görev yönetimi, filtreleme |
| `ekip` | 👥 | Takımlar ve üyeler, ekip yönetimi |
| `pano` | 📊 | Genel istatistikler, tüm projeler özeti |

### Modaller
- **Görev oluşturma** — başlık, açıklama, öncelik, atanan, son tarih
- **Görev düzenleme** — aynı alanlar + durum değişikliği + silme
- **Üye ekleme/düzenleme** — ad, rol, takım
- **Dosya görüntüleyici/editör** — sözdizimi vurgulaması olmadan, salt metin editör
- **Yeni dosya/klasör** — isim, içerik (dosya için)
- **Dosya paylaşma** — hedef proje, hedef klasör
- **Proje oluşturma/düzenleme** — tüm proje alanları + ikon/renk seçici

### Tasarım Notları
- Karanlık tema: `#1B1B2F` arka plan
- `theme-color` meta: `#1B1B2F` (PWA / mobil status bar)
- Apple mobile web app capable — PWA benzeri
- `user-scalable=no` — mobilde zoom kapalı
- Sidebar mobilde overlay ile açılır/kapanır
- Bottom nav sadece mobilde görünür

---

## 🌱 Seed Data (ilk açılışta otomatik yüklenir)

İlk çalıştırmada `seed_data()` fonksiyonu **6 proje, 12 takım, 120 üye** oluşturur:

| Proje | Kod | İkon | Renk | Disk Yolu |
|-------|-----|------|------|-----------|
| Emare Finance | FIN | 💰 | #27AE60 | ~/Desktop/Emare Finance |
| Emare Asistan | AST | 🤖 | #3498DB | ~/Desktop/asistan |
| EmareCloud | CLD | ☁️ | #9B59B6 | ~/Desktop/emarecloud |
| EmareHup | HUB | 🏭 | #F39C12 | ~/Desktop/EmareHup |
| SiberEmare | SBR | 🛡️ | #E74C3C | ~/Desktop/SiberEmare |
| DevM Platform | DVM | ⚡ | #1ABC9C | ~/Desktop/EmareHup/DevM |

Her projede **2 takım × 10 üye = 20 üye** bulunur.  
Üye roller sırası: Takım Lideri, Kıdemli Geliştirici (×2), Full-Stack Geliştirici (×2), Geliştirici (×2), Junior Geliştirici, QA / Test Uzmanı, DevOps Mühendisi.

> **Not:** Eğer `ekip.db` zaten varsa ve içinde kayıt varsa seed data tekrar çalışmaz.  
> Sıfırlamak için: `rm instance/ekip.db` → tekrar başlat.

---

## 🔧 Teknik Detaylar

### Güvenlik
- `SECRET_KEY = 'emare-ekip-2026'`
- Path traversal koruması: `_safe_path()` her dosya işleminde `normpath` kontrolü yapar
- JSON ASCII kapalı: Türkçe karakterler düzgün encode edilir

### Polling Mekanizması
- Frontend proje seçilince `setInterval` ile her **3 saniyede** bir `GET /api/projects/<pid>/feed?after=<lastMsgId>` çeker
- Sadece yeni mesajlar gelir (id'den büyükler)
- Proje değişince eski timer temizlenir

### Dosya Yöneticisi Kısıtlamaları
- Max okuma: 500.000 karakter (500KB)
- Binary dosyalar içerik olmadan metadata döner (`binary: true`)
- Arama: min 2 karakter, max 50 sonuç

### Görev Durum Akışı
```
yeni → devam → inceleme → tamamlandi
```
Durum değişince akışa otomatik sistem mesajı düşer.

### Öncelik Seviyeleri
```
dusuk (🟢) < orta (🟡) < yuksek (🟠) < acil (🔴)
```

---

## 📦 Bağımlılıklar (requirements.txt)

```
flask==3.1.0
flask-sqlalchemy==3.1.1
```

Başka hiç bağımlılık yok. SQLite Python'ın standart kütüphanesinde gelir.

---

## 🗺️ Nerede Kaldık? (3 Mart 2026)

### Tamamlananlar ✅
- [x] Temel backend (Flask + SQLAlchemy): Projeler, Takımlar, Üyeler, Görevler, Mesajlar
- [x] Tam CRUD API (tüm modeller için)
- [x] Frontend SPA (App + Files + ProjectMgr nesneleri)
- [x] Chat / akış ekranı (polling ile)
- [x] Görev yönetimi (oluştur / düzenle / sil / durum değiştir)
- [x] Ekip yönetimi (takım / üye CRUD)
- [x] Dosya gezgini (okuma, düzenleme, silme, oluşturma, paylaşma, indirme, arama)
- [x] Genel istatistik panosu
- [x] Proje yönetimi (oluştur / güncelle / sil, ikon + renk seçici)
- [x] Seed data (6 proje, 120 üye)
- [x] Mobil uyumlu tasarım (bottom nav, sidebar overlay)
- [x] Dosya paylaşımı (projeler arası kopyalama)
- [x] start.sh başlatma scripti

### Olası Sonraki Adımlar 🚧
- [ ] Kullanıcı girişi / kimlik doğrulama (şu an herkese açık)
- [ ] Görev yorumları / alt görevler
- [ ] Dosya diff / versiyon geçmişi
- [ ] WebSocket ile realtime mesajlaşma (şu an polling)
- [ ] Bildirim sistemi (deadline yaklaştında uyarı)
- [ ] Kişisel görev görünümü (kişiye göre filtrele)
- [ ] Export (görevler CSV/PDF)
- [ ] Drag & drop kanban

---

## 🐛 Bilinen Durumlar

- Üye `is_online` durumu seed'de `random.random() > 0.5` ile rastgele atanır; gerçek online takibi yok
- `updated_at` Task'ta `onupdate` ile otomatik güncellenir ama ilk commit'te `None` gelebilir (`if self.updated_at else None` ile kurtarılmış)
- Projeye disk `path` verilmezse dosya gezgini çalışmaz (404 döner)
- Polling her 3 saniyede çalışır — çok fazla sekme açık olursa sunucu yükü artabilir

---

## 💡 Hatırlatıcı Komutlar

```bash
# Başlat
cd /Users/emre/Desktop/ekip-yonetici && ./start.sh

# Manuel başlat
source .venv/bin/activate && python app.py

# Veritabanını sıfırla (seed data yeniden yüklenir)
rm instance/ekip.db

# Bağımlılık ekle
source .venv/bin/activate
pip install <paket>
pip freeze > requirements.txt

# Port kullanımda mı kontrol et
lsof -i :5050
```

---

> Bu dosyayı güncellemeyi unutma! Her büyük değişiklikten sonra "Nerede Kaldık?" bölümünü güncellemek yeterli.
