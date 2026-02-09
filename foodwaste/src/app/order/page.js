"use client"
import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase' 

export default function MyOrders() {
  const [orders, setOrders] = useState([])

  useEffect(() => {
    async function fetchOrders() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      const { data } = await supabase
        .from('transactions')
        .select('*')
        .eq('buyer_id', session.user.id)
        .order('created_at', { ascending: false })
      
      setOrders(data || [])
    }
    fetchOrders()
  }, [])

  return (
    <div className="min-h-screen bg-gray-50 p-6 font-sans">
      <h1 className="text-2xl font-bold mb-6">Tiket Makanan Saya 🎟️</h1>
      <div className="grid gap-4">
        {orders.map(order => (
          <div key={order.id} className="bg-white p-4 rounded-xl shadow-sm border flex justify-between items-center">
            <div className="flex gap-4">
               <img src={order.item_image} className="w-16 h-16 rounded-lg object-cover bg-gray-200" />
               <div>
                 <h3 className="font-bold">{order.item_name}</h3>
                 <p className={`text-xs font-bold uppercase px-2 py-1 rounded inline-block mt-1 ${
                    order.status === 'pending' ? 'bg-yellow-100 text-yellow-700' : 
                    order.status === 'completed' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                 }`}>
                   {order.status === 'pending' ? 'Belum Diambil' : order.status}
                 </p>
               </div>
            </div>
            
            {order.status === 'pending' && (
              <div className="text-right">
                <p className="text-xs text-gray-400">Tunjukkan kode ini ke Kasir:</p>
                <p className="text-2xl font-mono font-black text-blue-600 tracking-widest">{order.unique_code}</p>
              </div>
            )}
          </div>
        ))}
        {orders.length === 0 && <p className="text-gray-400">Belum ada pesanan.</p>}
      </div>
      <a href="/" className="block mt-8 text-center text-green-600 font-bold">← Kembali Belanja</a>
    </div>
  )
}