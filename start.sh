#!/bin/bash
cd "$(dirname "$0")"

if [ ! -d ".venv" ]; then
    echo "🔧 Sanal ortam oluşturuluyor..."
    python3 -m venv .venv
fi

source .venv/bin/activate
pip install -q -r requirements.txt

echo ""
echo "🚀 Emare Ekip Yönetici başlatılıyor..."
echo "   http://localhost:5050"
echo ""
python app.py
