"use client"
import { useState } from 'react'
import { supabase } from '../../lib/supabase' 
import { useRouter } from 'next/navigation'

export default function RegisterPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [role, setRole] = useState('buyer') 

  const handleRegister = async (e) => {
    e.preventDefault()
    setLoading(true)
    const form = e.target
    const email = form.email.value
    const password = form.password.value
    
    // 1. DAFTAR AKUN (AUTH)
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    })

    if (error) {
      alert("Gagal Daftar Akun: " + error.message)
      setLoading(false)
      return
    }

    // 2. MASUKKAN DATA KE PROFIL
    if (data?.user) {
        const profilePayload = {
            id: data.user.id,
            // SAYA HAPUS BARIS EMAIL DI SINI SUPAYA TIDAK ERROR LAGI
            store_name: role === 'seller' ? form.storeName.value : null,
            whatsapp_number: role === 'seller' ? form.wa.value : null
        }

        const { error: profileError } = await supabase
            .from('profiles')
            .upsert([profilePayload]) 

        if (profileError) {
            console.error("Gagal buat profil:", profileError)
            alert("Gagal simpan profil: " + profileError.message)
        } else {
            alert(role === 'seller' ? "✅ Toko Berhasil Dibuat! Silakan Login." : "✅ Akun Pembeli Siap! Silakan Belanja.")
            router.push('/login')
        }
    }
    
    setLoading(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 font-sans p-4 relative">
      <a href="/" className="absolute top-6 left-6 text-gray-500 hover:text-green-700 font-bold flex items-center gap-2 text-sm transition">
        ← Kembali ke Menu Utama
      </a>

      <div className="bg-white p-8 rounded-xl shadow-md w-full max-w-md mt-10">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-green-700">Daftar Akun Baru ✨</h1>
          <p className="text-gray-400 text-sm">Pilih peranmu di ResQ-Food.</p>
        </div>

        <div className="flex bg-gray-100 p-1 rounded-lg mb-6">
            <button 
                type="button" 
                onClick={() => setRole('buyer')}
                className={`flex-1 py-2 text-sm font-bold rounded-md transition ${role === 'buyer' ? 'bg-white text-green-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
            >
                👤 Pembeli
            </button>
            <button 
                type="button" 
                onClick={() => setRole('seller')}
                className={`flex-1 py-2 text-sm font-bold rounded-md transition ${role === 'seller' ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
            >
                🏪 Penjual
            </button>
        </div>

        <form onSubmit={handleRegister} className="space-y-4">
          {role === 'seller' && (
            <div className="bg-blue-50 p-4 rounded-lg border border-blue-100 mb-4 animate-fade-in">
                <div className="mb-3">
                    <label className="block text-xs font-bold text-blue-800 mb-1">Nama Toko</label>
                    <input name="storeName" placeholder="Contoh: Roti Bakar 88" className="w-full border p-2 rounded bg-white text-sm text-gray-900 placeholder-gray-400" required />
                </div>
                <div>
                    <label className="block text-xs font-bold text-blue-800 mb-1">WhatsApp Bisnis</label>
                    <input name="wa" type="number" placeholder="628..." className="w-full border p-2 rounded bg-white text-sm text-gray-900 placeholder-gray-400" required />
                </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">Email</label>
            <input name="email" type="email" placeholder="email@contoh.com" className="w-full border p-3 rounded-lg bg-gray-50 focus:bg-white text-gray-900 placeholder-gray-400 transition" required />
          </div>
          
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">Password</label>
            <input name="password" type="password" placeholder="Minimal 6 karakter" className="w-full border p-3 rounded-lg bg-gray-50 focus:bg-white text-gray-900 placeholder-gray-400 transition" required />
          </div>
          
          <button disabled={loading} className={`w-full text-white font-bold py-3 rounded-lg transition shadow-lg transform active:scale-95 ${role === 'buyer' ? 'bg-green-600 hover:bg-green-700' : 'bg-blue-600 hover:bg-blue-700'}`}>
            {loading ? 'Mendaftarkan...' : (role === 'buyer' ? 'Daftar Jadi Pembeli 🛒' : 'Buka Toko Sekarang 🚀')}
          </button>
        </form>

        <p className="text-center mt-6 text-sm text-gray-500">
          Sudah punya akun? <a href="/login" className="text-green-700 font-bold hover:underline">Login disini</a>
        </p>
      </div>
    </div>
  )
}