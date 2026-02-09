"use client"
import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase' 
import { useRouter } from 'next/navigation'

export default function MyOrders() {
  const router = useRouter()
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchOrders() {
      // 1. Cek Login Dulu
      const { data: { session } } = await supabase.auth.getSession()
      
      if (!session) {
        // Kalau belum login, lempar ke halaman login
        router.push('/login')
        return
      }

      // 2. Ambil Data Pesanan User Ini
      const { data } = await supabase
        .from('transactions')
        .select('*')
        .eq('buyer_id', session.user.id)
        .order('created_at', { ascending: false })
      
      setOrders(data || [])
      setLoading(false)
    }
    fetchOrders()
  }, [])

  if (loading) return <div className="min-h-screen flex items-center justify-center text-green-600 font-bold">Memuat Tiket...</div>

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8 font-sans">
      <div className="max-w-md mx-auto">
        
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
            <a href="/" className="bg-white p-2 rounded-full shadow-sm hover:bg-gray-100 transition">
                ⬅️
            </a>
            <h1 className="text-2xl font-extrabold text-gray-800">Tiket Saya 🎟️</h1>
        </div>

        {/* List Tiket */}
        <div className="grid gap-4">
          {orders.map(order => (
            <div key={order.id} className="bg-white p-5 rounded-3xl shadow-sm border border-gray-100 flex flex-col gap-4 relative overflow-hidden transition hover:shadow-md">
              
              {/* Status Badge di Pojok */}
              <div className={`absolute top-0 right-0 px-4 py-1.5 text-[10px] font-black tracking-widest rounded-bl-2xl uppercase ${
                  order.status === 'pending' ? 'bg-yellow-100 text-yellow-700' : 
                  order.status === 'completed' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
              }`}>
                 {order.status === 'pending' ? '⏳ Belum Diambil' : (order.status === 'completed' ? '✅ Selesai' : '❌ Dibatalkan')}
              </div>

              {/* Info Barang */}
              <div className="flex gap-4 items-center mt-2">
                 <img src={order.item_image} className="w-16 h-16 rounded-2xl object-cover bg-gray-100 border" />
                 <div>
                   <h3 className="font-bold text-lg text-gray-900 leading-tight">{order.item_name}</h3>
                   <p className="text-xs text-gray-400 font-medium mt-1">Rp {parseInt(order.item_price).toLocaleString()}</p>
                 </div>
              </div>
              
              {/* KODE UNIK (Hanya muncul kalau belum diambil) */}
              {order.status === 'pending' ? (
                <div className="bg-green-50 p-4 rounded-2xl text-center border-2 border-dashed border-green-200 mt-2">
                  <p className="text-[10px] text-green-600 font-bold uppercase tracking-wider mb-1">Kode Penukaran</p>
                  <p className="text-4xl font-mono font-black text-green-700 tracking-widest selection:bg-green-200">
                    {order.unique_code}
                  </p>
                  <p className="text-[10px] text-gray-400 mt-2 font-medium">Tunjukkan kode ini ke kasir toko</p>
                </div>
              ) : (
                <div className="bg-gray-100 p-3 rounded-xl text-center">
                    <p className="text-xs text-gray-400 font-bold">Tiket sudah tidak berlaku</p>
                </div>
              )}
            </div>
          ))}

          {/* State Kosong */}
          {orders.length === 0 && (
            <div className="text-center py-20 opacity-50">
                <p className="text-6xl mb-4">🎫</p>
                <p className="text-gray-400 font-bold">Belum ada tiket aktif.</p>
                <a href="/" className="text-green-600 text-sm mt-2 block hover:underline">Yuk cari makanan murah!</a>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}