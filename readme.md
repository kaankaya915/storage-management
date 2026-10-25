# Depo Ürünleri — Netlify ve Çoklu Cihaz Kurulum Rehberi

Bu paket, **Depo Ürünleri** web uygulamasını hiçbir teknik bilgiye ihtiyaç duymadan **Netlify** üzerinde yayınlamanız ve farklı telefonlardan giren kullanıcıların aynı sunucu üzerinde **anlık (gerçek zamanlı)** stok takibi yapabilmesi için hazırlanmıştır.

## Paket İçeriği
- `index.html`: Tüm arayüzü (Sunucular, Ürünler, Mal Geliş Çizelgesi, Geçmiş ve Otomatik Günlük Tüketim Hesabı) barındıran ana uygulama dosyası.
- `firebase-config.js`: Farklı telefonlardan yapılan değişikliklerin anında eşitlenmesini sağlayan gerçek zamanlı veritabanı ayar dosyası.
- `README.md`: Adım adım kurulum ve kullanım kılavuzu.

## 1. Adım: Çoklu Telefon Eşitlemesi (Firebase Realtime Database) Kurulumu (2 Dakika)
Farklı telefonlardan giren kişilerin yaptığı değişikliklerin birbirinde anında görünmesi için ücretsiz Google Firebase veritabanı bağlantısı kullanılır:

1. [Firebase Console](https://console.firebase.google.com/) sayfasına gidin ve Google hesabınızla giriş yapın.
2. **"Create a project" (Proje Oluştur)** butonuna basıp `depo-urunleri` adını verin ve tamamlayın.
3. Sol menüden **Build > Realtime Database** sekmesine tıklayın ve **"Create Database"** butonuna basın.
4. Güvenlik kuralları adımında **"Start in test mode" (Test modunda başlat)** seçeneğini işaretleyip **Enable** deyin.
5. Açılan ekranda size verilen `https://....firebasedatabase.app` uzantılı adresi kopyalayın.
6. Kopyaladığınız bu adresi:
   - İsterseniz `firebase-config.js` dosyasındaki `databaseURL: ""` tırnaklarının içine yapıştırıp kaydedin,
   - İsterseniz hiç dosya düzenlemeden `index.html` dosyasını tarayıcıda açıp sağ üstteki **"Yerel Mod / Senkron"** butonuna tıklayın, adresi kutuya yapıştırıp **"Gömülü Netlify Dosyasını İndir"** butonuna basın.

## 2. Adım: Netlify'a Yükleme (Sürükle ve Bırak)
1. [Netlify Drop](https://app.netlify.com/drop) sayfasını açın.
2. Klasörü (veya `depo-urunleri-netlify.zip` dosyasını) sayfadaki kutunun içine sürükleyip bırakın.
3. Netlify saniyeler içinde sitenizi yayına alacak ve size `https://....netlify.app` şeklinde bir site adresi verecektir. Bu linki depodaki tüm çalışanların telefonuna gönderebilirsiniz.

## 3. Adım: Uygulama Özellikleri ve Kullanımı
- **Ana Sayfa (Sunucular):** İstediğiniz isim ve şifreyle sunucu açabilirsiniz. İlk deneme için içinde örnek veriler bulunan `Merkez Depo` (Şifre: `1234`) hazır gelir.
- **Ürünler Sayfası:** Sağ üstteki **`+`** ikonuyla sınırsız sayıda ürün (30, 50 veya daha fazla çeşit) ekleyebilirsiniz. Her ürünün yanında sade **`-`** ve **`+`** butonları yer alır; ayrıca doğrudan koli sayısının üstüne tıklayarak klavyeden istediğiniz adedi girebilirsiniz.
- **Mal Geliş Sayfası:** Alt menüden **Mal Geliş** sekmesine geçerek şirketlerin geliş günlerini sütun halinde (`Coca-Cola` — `Cumartesi`, `Eti` — `Pazarları`, `Ayrancı` — `2 haftada bir Çarşamba` gibi) ekleyebilir ve düzenleyebilirsiniz.
- **Geçmiş ve Otomatik Günlük Satış Hesabı:** Alt menüden **Geçmiş** sekmesine geçip **"Yeni Teslimat Ekle"** formundan gelen koli sayısını girdiğinizde:
  - Yeni gelen koliler **otomatik olarak depodaki kalan ürün sayısına eklenir** (`Önceki Elde Kalan + Yeni Gelen = Teslimat Anındaki Toplam Stok`).
  - Günler geçtikçe ve ana sayfadan stok düştükçe sistem `(Teslimat Anındaki Toplam Stok − Şu An Kalan Koli) ÷ Geçen Gün` formülüyle (örneğin elde 2 varken 8 gelip 10 olduğunda ve 3 gün sonra 5 kaldığında 5 koli gitmiş sayarak) günlük ortalamayı hesaplar ve ürünün yanında **`günde X koli`** olarak gösterir.
- **Açık / Koyu Tema (Light / Dark Mode):** Sayfanın sağ alt köşesinde göz yormayan, yalnızca arandığında fark edilen **`◐ Koyu / Açık Görünüm`** düğmesi yer alır.
