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
  
  // Filter State
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('Semua')

  // --- STATE MODAL CHECKOUT & PAYMENT ---
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [selectedItem, setSelectedItem] = useState(null)
  const [qty, setQty] = useState(1)
  const [paymentStep, setPaymentStep] = useState('order') // 'order' | 'payment' | 'processing' | 'success'
  const [paymentMethod, setPaymentMethod] = useState('qris') // 'qris' | 'va'

  useEffect(() => {
    fetchSales()
  }, [])

  async function fetchSales() {
    const { data } = await supabase.from('discounted_items').select('*')
    if (data) {
        const today = new Date().toISOString().split('T')[0]
        const freshItems = data.filter(item => item.expiry_date >= today)
        const sortedData = freshItems.sort((a, b) => (a.stock > 0 && b.stock <= 0 ? -1 : 1))
        setAllSales(sortedData)
        setFilteredSales(sortedData)
    }
    setLoading(false)
  }

  // --- LOGIKA FILTER ---
  useEffect(() => {
    let result = allSales
    if (search) {
      result = result.filter(item => 
        item.name.toLowerCase().includes(search.toLowerCase()) || 
        item.store_name.toLowerCase().includes(search.toLowerCase())
      )
    }
    if (category !== 'Semua') result = result.filter(item => item.category === category)
    setFilteredSales(result)
  }, [search, category, allSales])

  // --- LOGIKA CHECKOUT ---
  const handleOpenModal = (item) => {
    setSelectedItem(item)
    setQty(1)
    setPaymentStep('order')
    setIsModalOpen(true)
  }

  const handleQtyChange = (delta) => {
    const newQty = qty + delta
    if (newQty >= 1 && newQty <= selectedItem.stock) {
      setQty(newQty)
    }
  }

  const handleProcessPayment = async () => {
    // Cek Login
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
       alert("Silakan login dulu untuk membeli!")
       router.push('/login')
       return
    }

    setPaymentStep('processing')

    // SIMULASI LOADING PAYMENT GATEWAY (Biar kayak beneran)
    setTimeout(async () => {
        // 1. Generate Kode Unik
        const code = 'RSQ-' + Math.floor(1000 + Math.random() * 9000)

        // 2. Simpan ke Database
        const { error } = await supabase
          .from('transactions')
          .insert({
            item_id: selectedItem.id,
            buyer_id: session.user.id,
            seller_id: selectedItem.user_id,
            item_name: selectedItem.name,
            item_price: selectedItem.sale_price,
            item_image: selectedItem.image_url,
            status: 'pending',
            unique_code: code,
            quantity: qty,                 // <-- Jumlah Barang
            total_price: qty * selectedItem.sale_price // <-- Total Bayar
          })

        if (error) {
            alert("Transaksi Gagal: " + error.message)
            setPaymentStep('order')
        } else {
            setPaymentStep('success')
        }
    }, 2000) // Nunggu 2 detik pura-pura konek bank
  }

  const categories = ['Semua', 'Makanan Berat', 'Roti & Kue', 'Cemilan', 'Minuman', 'Bahan Mentah']

  return (
    <main className="min-h-screen bg-gray-50 font-sans text-gray-800">
      
      {/* NAVBAR */}
      <nav className="bg-white shadow-sm sticky top-0 z-50 border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-2">
               <span className="text-2xl">🌱</span>
               <h1 className="text-xl font-extrabold text-green-700 tracking-tight">ResQ-Food</h1>
            </div>
            <div className="flex gap-2">
                <a href="/orders" className="text-sm font-bold text-gray-500 hover:text-green-600 px-3 py-2 rounded-lg transition hover:bg-gray-50">
                  🎟️ Tiket Saya
                </a>
                <a href="/login" className="text-sm font-bold text-white bg-green-600 px-4 py-2 rounded-full transition hover:bg-green-700 shadow-md transform hover:scale-105">
                  Masuk / Daftar
                </a>
            </div>
          </div>
        </div>
      </nav>

      {/* HERO SECTION */}
      <div className="bg-green-700 text-white py-12 px-4 mb-8">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl md:text-5xl font-extrabold mb-4">Selamatkan Makanan, <br/>Selamatkan Dompet 💸</h2>
          <p className="text-green-100 text-lg mb-8">Diskon 50% untuk makanan enak sebelum kehabisan!</p>
          <div className="max-w-2xl mx-auto relative group">
             <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none z-10"><span className="text-2xl">🔍</span></div>
             <input placeholder="Cari nasi goreng, roti, atau nama toko..." className="block w-full pl-14 pr-6 py-4 rounded-full bg-white text-gray-900 placeholder-gray-500 shadow-xl focus:outline-none focus:ring-4 focus:ring-green-400 focus:shadow-2xl transition-all duration-300 text-lg font-medium" value={search} onChange={(e) => setSearch(e.target.value)}/>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-20">
        <div className="flex gap-2 overflow-x-auto pb-4 no-scrollbar mb-6 justify-start md:justify-center">
            {categories.map(cat => (<button key={cat} onClick={() => setCategory(cat)} className={`px-5 py-2 rounded-full text-sm font-bold whitespace-nowrap transition border ${category === cat ? 'bg-green-600 text-white border-green-600 shadow-lg transform scale-105' : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-100'}`}>{cat}</button>))}
        </div>

        {loading ? (
           <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">{[1,2,3,4].map(i => <div key={i} className="bg-white rounded-2xl h-80 animate-pulse border"><div className="h-48 bg-gray-200 rounded-t-2xl"></div><div className="p-4 space-y-3"><div className="h-4 bg-gray-200 w-3/4 rounded"></div><div className="h-4 bg-gray-200 w-1/2 rounded"></div></div></div>)}</div>
        ) : (
          <>
            <div className="flex justify-between items-end mb-4 border-b pb-2">
               <h3 className="font-bold text-xl text-gray-800">🔥 Promo Terdekat</h3>
               <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">{filteredSales.length} items</span>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredSales.map((item) => (
                <div key={item.id} className={`bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-xl transition-all duration-300 hover:-translate-y-1 ${item.stock <= 0 ? 'opacity-60 grayscale-[0.8]' : ''}`}>
                <div className="h-48 w-full bg-gray-100 relative group">
                    <img src={item.image_url || "https://images.unsplash.com/photo-1546069901-ba9599a7e63c"} alt={item.name} className="w-full h-full object-cover transition duration-500 group-hover:scale-110" />
                    <div className="absolute top-3 left-3 bg-black/50 backdrop-blur text-white text-[10px] font-bold px-2 py-1 rounded">{item.category || 'Umum'}</div>
                    {item.stock > 0 ? <div className="absolute top-3 right-3 bg-red-600 text-white text-xs font-bold px-3 py-1 rounded-full shadow-lg">50% OFF</div> : <div className="absolute inset-0 bg-black/50 flex items-center justify-center"><span className="border-2 border-white text-white font-black px-4 py-1 rounded transform -rotate-12">HABIS</span></div>}
                </div>
                <div className="p-4 flex flex-col h-[200px] justify-between">
                    <div>
                    <div className="flex justify-between items-start mb-2"><span className="text-[10px] font-bold text-gray-500 uppercase bg-gray-100 px-2 py-1 rounded truncate max-w-[120px]">🏪 {item.store_name}</span><span className="text-[10px] text-red-500 font-bold bg-red-50 px-2 py-1 rounded border border-red-100">Exp: {item.expiry_date.slice(5)}</span></div>
                    <h3 className="font-bold text-lg text-gray-900 leading-tight mb-1 line-clamp-2">{item.name}</h3>
                    {item.stock > 0 && item.stock < 5 && <p className="text-xs text-red-500 font-bold animate-pulse">⚡ Sisa {item.stock} porsi!</p>}
                    </div>
                    <div>
                    <div className="flex items-end justify-between mb-3"><div className="flex flex-col"><span className="text-xs text-gray-400 line-through">Rp {item.original_price.toLocaleString()}</span><span className="text-xl font-extrabold text-green-600">Rp {item.sale_price.toLocaleString()}</span></div></div>
                    {item.stock > 0 ? (
                        <button onClick={() => handleOpenModal(item)} className="block w-full bg-green-600 text-white text-center py-2.5 rounded-lg font-bold hover:bg-green-700 transition shadow-lg active:scale-95">Beli Sekarang 🛒</button>
                    ) : (
                        <button disabled className="block w-full bg-gray-100 text-gray-400 text-center py-2.5 rounded-lg font-bold cursor-not-allowed border">Stok Habis</button>
                    )}
                    </div>
                </div>
                </div>
            ))}
            </div>
          </>
        )}
      </div>
      
      {/* ========================================= */}
      {/* 🔥 MODAL CHECKOUT & PAYMENT GATEWAY ALA-ALA */}
      {/* ========================================= */}
      {isModalOpen && selectedItem && (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-4 transition-all">
           <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden animate-slide-up">
              
              {/* HEADER MODAL */}
              <div className="p-4 border-b flex justify-between items-center bg-gray-50">
                 <h3 className="font-bold text-lg">Checkout Pesanan 🛍️</h3>
                 <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-red-500 font-bold text-xl">×</button>
              </div>

              {/* STEP 1: PILIH JUMLAH */}
              {paymentStep === 'order' && (
                <div className="p-6">
                    <div className="flex gap-4 mb-6">
                        <img src={selectedItem.image_url} className="w-20 h-20 rounded-lg object-cover bg-gray-100" />
                        <div>
                            <h4 className="font-bold text-gray-800">{selectedItem.name}</h4>
                            <p className="text-sm text-gray-500 mb-1">{selectedItem.store_name}</p>
                            <p className="text-green-600 font-bold">Rp {selectedItem.sale_price.toLocaleString()}</p>
                        </div>
                    </div>

                    <div className="flex justify-between items-center mb-6 bg-gray-50 p-4 rounded-xl border border-dashed border-gray-300">
                        <span className="font-bold text-gray-600">Jumlah Porsi</span>
                        <div className="flex items-center gap-4">
                            <button onClick={() => handleQtyChange(-1)} className="w-8 h-8 rounded-full bg-white border shadow flex items-center justify-center font-bold text-gray-600 hover:bg-gray-100">-</button>
                            <span className="font-bold text-xl w-6 text-center">{qty}</span>
                            <button onClick={() => handleQtyChange(1)} className="w-8 h-8 rounded-full bg-green-600 text-white shadow flex items-center justify-center font-bold hover:bg-green-700">+</button>
                        </div>
                    </div>

                    <div className="border-t pt-4 mb-6">
                        <div className="flex justify-between items-center text-lg font-bold">
                            <span>Total Bayar</span>
                            <span className="text-green-700">Rp {(qty * selectedItem.sale_price).toLocaleString()}</span>
                        </div>
                    </div>

                    <button onClick={() => setPaymentStep('payment')} className="w-full bg-green-600 text-white py-3 rounded-xl font-bold shadow-lg hover:bg-green-700 transition">
                        Lanjut Pembayaran →
                    </button>
                </div>
              )}

              {/* STEP 2: PAYMENT GATEWAY ALA-ALA */}
              {paymentStep === 'payment' && (
                <div className="p-6">
                    <h4 className="font-bold text-gray-700 mb-4 text-center">Pilih Metode Pembayaran 💳</h4>
                    
                    <div className="space-y-3 mb-6">
                        <button onClick={() => setPaymentMethod('qris')} className={`w-full flex items-center justify-between p-4 rounded-xl border-2 transition ${paymentMethod === 'qris' ? 'border-green-500 bg-green-50' : 'border-gray-200 hover:border-green-200'}`}>
                            <span className="font-bold flex items-center gap-2">📱 QRIS / E-Wallet</span>
                            {paymentMethod === 'qris' && <span className="text-green-600">✓</span>}
                        </button>
                        <button onClick={() => setPaymentMethod('va')} className={`w-full flex items-center justify-between p-4 rounded-xl border-2 transition ${paymentMethod === 'va' ? 'border-green-500 bg-green-50' : 'border-gray-200 hover:border-green-200'}`}>
                            <span className="font-bold flex items-center gap-2">🏦 Virtual Account</span>
                            {paymentMethod === 'va' && <span className="text-green-600">✓</span>}
                        </button>
                    </div>
                    
                    {/* Simulasi Data Pembeli */}
                    <div className="bg-blue-50 p-3 rounded-lg text-xs text-blue-700 mb-6">
                        <p>ℹ️ No. HP Anda akan digunakan untuk konfirmasi pesanan.</p>
                    </div>

                    <div className="flex gap-3">
                        <button onClick={() => setPaymentStep('order')} className="flex-1 py-3 font-bold text-gray-500 hover:bg-gray-100 rounded-xl">Kembali</button>
                        <button onClick={handleProcessPayment} className="flex-[2] bg-green-600 text-white py-3 rounded-xl font-bold shadow-lg hover:bg-green-700 transition">
                            Bayar Rp {(qty * selectedItem.sale_price).toLocaleString()}
                        </button>
                    </div>
                </div>
              )}

              {/* STEP 3: PROCESSING (LOADING) */}
              {paymentStep === 'processing' && (
                <div className="p-10 text-center">
                    <div className="w-16 h-16 border-4 border-green-200 border-t-green-600 rounded-full animate-spin mx-auto mb-4"></div>
                    <h4 className="font-bold text-gray-800 text-lg">Memproses Pembayaran...</h4>
                    <p className="text-gray-400 text-sm">Jangan tutup halaman ini.</p>
                </div>
              )}

              {/* STEP 4: SUCCESS */}
              {paymentStep === 'success' && (
                <div className="p-8 text-center bg-green-600 text-white h-full">
                    <div className="bg-white text-green-600 w-20 h-20 rounded-full flex items-center justify-center text-4xl mx-auto mb-4 shadow-xl">✓</div>
                    <h2 className="text-2xl font-black mb-2">Pembayaran Berhasil!</h2>
                    <p className="text-green-100 mb-8">Tiket pesanan Anda sudah terbit.</p>
                    <button onClick={() => window.location.href = '/orders'} className="w-full bg-white text-green-700 py-3 rounded-xl font-bold shadow-lg hover:bg-gray-100 transition">
                        Lihat Tiket Saya 🎟️
                    </button>
                </div>
              )}
           </div>
        </div>
      )}

      <footer className="bg-white border-t mt-10 py-8 text-center"><p className="text-gray-400 text-sm">© 2024 ResQ-Food Indonesia.<br/>Created by Samuel (Computer Science BINUS) 🎓</p></footer>
    </main>
  )
}