"use client"
import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase' 
import { useRouter } from 'next/navigation'

export default function Home() {
  const router = useRouter()
  
  // Data State
  const [allSales, setAllSales] = useState([]) 
  const [filteredSales, setFilteredSales] = useState([]) 
  const [loading, setLoading] = useState(true)
  const [userLocation, setUserLocation] = useState(null)
  
  // Filter State
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('Semua')

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [selectedItem, setSelectedItem] = useState(null)
  const [qty, setQty] = useState(1)
  const [paymentStep, setPaymentStep] = useState('order')
  const [paymentMethod, setPaymentMethod] = useState('qris')

  useEffect(() => {
    // 1. Cek Izin Lokasi Pembeli
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition((position) => {
            setUserLocation({
                lat: position.coords.latitude,
                lng: position.coords.longitude
            })
        }, (err) => console.log("Lokasi tidak diizinkan:", err))
    }
    fetchSales()
  }, [])

  // Rumus Hitung Jarak (Haversine)
  const calculateDistance = (lat1, lon1, lat2, lon2) => {
    if (!lat1 || !lon1 || !lat2 || !lon2) return null; 
    const R = 6371; 
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    const a = 
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * Math.sin(dLon / 2) * Math.sin(dLon / 2); 
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)); 
    return (R * c).toFixed(1); 
  }

  async function fetchSales() {
    const { data } = await supabase.from('discounted_items').select('*')
    if (data) {
        const today = new Date().toISOString().split('T')[0]
        const freshItems = data.filter(item => item.expiry_date >= today)
        setAllSales(freshItems)
    }
    setLoading(false)
  }

  // LOGIKA SORTING & FILTER
  useEffect(() => {
    let result = [...allSales]

    if (search) {
      result = result.filter(item => 
        item.name.toLowerCase().includes(search.toLowerCase()) || 
        item.store_name.toLowerCase().includes(search.toLowerCase())
      )
    }
    if (category !== 'Semua') result = result.filter(item => item.category === category)

    if (userLocation) {
        result = result.map(item => ({
            ...item,
            distance: calculateDistance(userLocation.lat, userLocation.lng, item.latitude, item.longitude)
        }))
        result.sort((a, b) => {
            if (a.stock > 0 && b.stock <= 0) return -1;
            if (a.stock <= 0 && b.stock > 0) return 1;
            
            const distA = a.distance ? parseFloat(a.distance) : 9999;
            const distB = b.distance ? parseFloat(b.distance) : 9999;
            return distA - distB;
        })
    } else {
        result.sort((a, b) => (a.stock > 0 && b.stock <= 0 ? -1 : 1))
    }

    setFilteredSales(result)
  }, [search, category, allSales, userLocation])

  const handleOpenModal = (item) => { setSelectedItem(item); setQty(1); setPaymentStep('order'); setIsModalOpen(true) }
  const handleQtyChange = (delta) => { const newQty = qty + delta; if (newQty >= 1 && newQty <= selectedItem.stock) setQty(newQty) }
  
  const handleProcessPayment = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { alert("Silakan login dulu!"); router.push('/login'); return }
    setPaymentStep('processing')
    setTimeout(async () => {
        const code = 'RSQ-' + Math.floor(1000 + Math.random() * 9000)
        const { error } = await supabase.from('transactions').insert({
            item_id: selectedItem.id, buyer_id: session.user.id, seller_id: selectedItem.user_id,
            item_name: selectedItem.name, item_price: selectedItem.sale_price, item_image: selectedItem.image_url,
            status: 'pending', unique_code: code, quantity: qty, total_price: qty * selectedItem.sale_price
        })
        if (error) { alert("Gagal: " + error.message); setPaymentStep('order') } else { setPaymentStep('success') }
    }, 2000) 
  }

  const categories = ['Semua', 'Makanan Berat', 'Roti & Kue', 'Cemilan', 'Minuman', 'Bahan Mentah']

  return (
    <main className="min-h-screen bg-gray-50 font-sans text-gray-800 relative">
      
      {/* NAVBAR */}
      <nav className="bg-white shadow-sm sticky top-0 z-50 border-b">
        <div className="max-w-7xl mx-auto px-4 h-16 flex justify-between items-center">
            <div className="flex items-center gap-2"><span className="text-2xl">🌱</span><h1 className="text-xl font-extrabold text-green-700">ResQ-Food</h1></div>
            <div className="flex gap-2">
                <a href="/orders" className="text-sm font-bold text-gray-500 hover:text-green-600 px-3 py-2">🎟️ Tiket</a>
                <a href="/login" className="text-sm font-bold text-white bg-green-600 px-4 py-2 rounded-full shadow hover:bg-green-700">Login</a>
            </div>
        </div>
      </nav>

      {/* HERO SECTION */}
      <div className="bg-green-700 text-white py-12 px-4 mb-8 text-center">
          <h2 className="text-3xl md:text-5xl font-extrabold mb-4">Selamatkan Makanan 🍔</h2>
          <p className="text-green-100 mb-6">{userLocation ? "📍 Menampilkan makanan di sekitarmu" : "🔍 Aktifkan lokasi untuk urutan jarak"}</p>
          <div className="max-w-lg mx-auto relative text-gray-900">
             <span className="absolute left-4 top-3.5 text-xl">🔍</span>
             <input 
                placeholder="Cari nasi goreng, roti, dll..." 
                className="w-full pl-12 pr-6 py-3.5 rounded-full shadow-xl focus:outline-none font-medium bg-white text-gray-900" 
                value={search} 
                onChange={(e) => setSearch(e.target.value)}
             />
          </div>
      </div>

      {/* CONTENT */}
      <div className="max-w-7xl mx-auto px-4 pb-20">
        <div className="flex gap-2 overflow-x-auto pb-4 no-scrollbar mb-6 justify-center">
            {categories.map(cat => (<button key={cat} onClick={() => setCategory(cat)} className={`px-5 py-2 rounded-full text-sm font-bold border transition ${category === cat ? 'bg-green-600 text-white shadow-lg' : 'bg-white text-gray-500 hover:bg-gray-100'}`}>{cat}</button>))}
        </div>

        {loading ? <p className="text-center animate-pulse">Sedang memuat makanan enak...</p> : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {filteredSales.map((item) => (
                <div key={item.id} className={`bg-white rounded-2xl shadow-sm border overflow-hidden hover:shadow-xl transition relative ${item.stock <= 0 ? 'opacity-60' : ''}`}>
                    <div className="h-48 w-full bg-gray-100 relative group">
                        <img src={item.image_url || "https://images.unsplash.com/photo-1546069901-ba9599a7e63c"} className="w-full h-full object-cover" />
                        <div className="absolute top-3 left-3 bg-black/50 backdrop-blur text-white text-[10px] font-bold px-2 py-1 rounded">{item.category}</div>
                        {item.distance && (
                            <div className="absolute bottom-3 right-3 bg-white/90 backdrop-blur text-gray-800 text-xs font-bold px-2 py-1 rounded-lg shadow flex items-center gap-1">📍 {item.distance} km</div>
                        )}
                        {item.stock > 0 && <div className="absolute top-3 right-3 bg-red-600 text-white text-xs font-bold px-3 py-1 rounded-full">50% OFF</div>}
                    </div>
                    
                    <div className="p-4">
                        {/* --- 🔥 UPDATE JAM BUKA (TAMPIL DI CARD) --- */}
                        <div className="flex justify-between items-start mb-2">
                            <span className="text-[10px] font-bold text-gray-500 uppercase bg-gray-100 px-2 py-1 rounded truncate max-w-[120px]">🏪 {item.store_name}</span>
                            <span className="text-[10px] font-bold text-gray-400 bg-gray-50 px-2 py-1 rounded border">🕒 {item.opening_hour?.slice(0,5)} - {item.closing_hour?.slice(0,5)}</span>
                        </div>
                        {/* ------------------------------------------- */}

                        <h3 className="font-bold text-lg text-gray-900 leading-tight mb-1 line-clamp-1">{item.name}</h3>
                        {item.stock > 0 ? (
                            <p className={`text-xs font-bold ${item.stock < 5 ? 'text-red-600 animate-pulse' : 'text-green-600'}`}>🔥 Tersisa {item.stock} porsi!</p>
                        ) : (
                            <p className="text-xs font-bold text-gray-400">Stok Habis</p>
                        )}

                        <div className="flex items-end justify-between mt-3">
                            <div>
                                <span className="text-xs text-gray-400 line-through">Rp {item.original_price.toLocaleString()}</span><br/>
                                <span className="text-xl font-extrabold text-green-600">Rp {item.sale_price.toLocaleString()}</span>
                            </div>
                            <div className="flex gap-1.5">
                                <a href={item.latitude ? `https://www.google.com/maps/dir/?api=1&destination=${item.latitude},${item.longitude}` : `https://www.google.com/maps/search/?api=1&query=${item.store_name}`} target="_blank" className="bg-orange-100 text-orange-600 p-2.5 rounded-lg hover:bg-orange-200 transition" title="Lihat Lokasi">🗺️</a>
                                <a href={`https://wa.me/${item.whatsapp_number}?text=Halo ${item.store_name}, stok ${item.name} masih ada?`} target="_blank" className="bg-blue-100 text-blue-600 p-2.5 rounded-lg hover:bg-blue-200 transition" title="Chat Penjual">💬</a>
                                {item.stock > 0 ? (
                                    <button onClick={() => handleOpenModal(item)} className="bg-green-600 text-white px-3 py-2.5 rounded-lg font-bold hover:bg-green-700 text-sm">Beli</button>
                                ) : (
                                    <button disabled className="bg-gray-100 text-gray-400 px-3 py-2.5 rounded-lg font-bold text-sm border">Habis</button>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            ))}
          </div>
        )}
      </div>

      {/* MODAL CHECKOUT */}
      {isModalOpen && selectedItem && (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
           <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden animate-slide-up">
              <div className="p-4 border-b flex justify-between items-center bg-gray-50"><h3 className="font-bold">Checkout</h3><button onClick={()=>setIsModalOpen(false)}>×</button></div>
              {paymentStep === 'order' && (
                <div className="p-6">
                    <h4 className="font-bold mb-1">{selectedItem.name}</h4>
                    <p className="text-sm text-gray-500 mb-4">{selectedItem.store_name}</p>
                    
                    {/* --- 🔥 INFO LOKASI & JAM DI MODAL --- */}
                    <div className="bg-blue-50 p-3 rounded-lg mb-4 text-xs text-blue-800 border border-blue-100">
                        <div className="flex justify-between mb-1">
                            <span className="font-bold">📍 Jarak:</span>
                            <span>{selectedItem.distance ? selectedItem.distance + ' km' : '-'}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="font-bold">⏰ Jam Ambil:</span>
                            <span>{selectedItem.opening_hour?.slice(0,5)} - {selectedItem.closing_hour?.slice(0,5)} WIB</span>
                        </div>
                    </div>
                    {/* --------------------------------------- */}

                    <div className="flex justify-between items-center mb-6 border p-3 rounded-lg"><span className="font-bold">Jumlah</span><div className="flex gap-4 items-center"><button onClick={()=>handleQtyChange(-1)}>-</button><span className="font-bold">{qty}</span><button onClick={()=>handleQtyChange(1)}>+</button></div></div>
                    <div className="flex justify-between font-bold text-lg mb-6"><span>Total</span><span className="text-green-600">Rp {(qty * selectedItem.sale_price).toLocaleString()}</span></div>
                    <button onClick={()=>setPaymentStep('payment')} className="w-full bg-green-600 text-white py-3 rounded-xl font-bold">Lanjut Bayar</button>
                </div>
              )}
              {paymentStep === 'payment' && (
                <div className="p-6">
                    <h4 className="font-bold mb-4 text-center">Pilih Pembayaran</h4>
                    <div className="space-y-2 mb-4">
                        <button onClick={()=>setPaymentMethod('qris')} className={`w-full p-3 border rounded-lg ${paymentMethod==='qris'?'border-green-500 bg-green-50':''}`}>📱 QRIS</button>
                        <button onClick={()=>setPaymentMethod('va')} className={`w-full p-3 border rounded-lg ${paymentMethod==='va'?'border-green-500 bg-green-50':''}`}>🏦 Transfer Bank</button>
                    </div>
                    <button onClick={handleProcessPayment} className="w-full bg-green-600 text-white py-3 rounded-xl font-bold">Bayar Sekarang</button>
                </div>
              )}
              {paymentStep === 'processing' && (<div className="p-10 text-center font-bold">⏳ Memproses...</div>)}
              {paymentStep === 'success' && (
                  <div className="p-8 text-center">
                      <h2 className="text-2xl font-bold text-green-600 mb-2">Berhasil! 🎉</h2>
                      <p className="mb-4 text-gray-500">Silakan ambil pesanan Anda sesuai jam operasional.</p>
                      <button onClick={()=>window.location.href='/orders'} className="bg-green-600 text-white px-6 py-2 rounded-lg font-bold">Lihat Tiket</button>
                  </div>
              )}
           </div>
        </div>
      )}

      {/* TOMBOL FLOATING CS */}
      <a href="https://wa.me/6281234567890?text=Halo Admin ResQ, saya mau melaporkan masalah transaksi..." target="_blank" className="fixed bottom-6 left-6 bg-blue-600 text-white p-4 rounded-full shadow-2xl hover:bg-blue-700 transition-all z-50 flex items-center gap-2 group hover:pr-6">
        <span className="text-2xl">🎧</span>
        <span className="max-w-0 overflow-hidden group-hover:max-w-xs transition-all duration-500 whitespace-nowrap font-bold text-sm">Lapor / Bantuan</span>
      </a>

      <footer className="bg-white border-t mt-10 py-8 text-center"><p className="text-gray-400 text-sm">© 2026 ResQ-Food Indonesia.<br/>Created by Samuel (Computer Science BINUS) 🎓</p></footer>
    </main>
  )
}