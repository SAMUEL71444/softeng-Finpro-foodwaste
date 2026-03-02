"use client"
import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  const handleLogin = async (e) => {
    e.preventDefault()
    setLoading(true)

    // 1. Login ke Supabase
    const { data: { user }, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      alert("❌ Login Gagal: " + error.message)
      setLoading(false)
      return
    }

    // 2. CEK PERAN: Ambil data role dan store_name dari database
    const { data: profile } = await supabase
      .from('profiles')
      .select('store_name, role') // 🔥 RADAR AKTIF: Sekarang ngambil kolom 'role' juga!
      .eq('id', user.id)
      .single()

    // 3. LOGIKA REDIRECT PINTAR 🧠
    if (profile?.role === 'superadmin') {
      // 👑 JALUR VIP: Bos Besar langsung ke Markas!
      router.push('/superadmin')
    } else if (profile?.store_name || profile?.role === 'seller') {
      // 🏪 JALUR PENJUAL: Punya toko, masuk ke Admin Panel
      router.push('/admin')
    } else {
      // 🛒 JALUR UMUM: Pembeli biasa, masuk ke Beranda
      router.push('/') 
    }
    
    router.refresh()
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 font-sans p-4">
      <a href="/" className="absolute top-6 left-6 text-gray-500 hover:text-green-700 font-bold flex items-center gap-2 text-sm transition">
        ← Kembali Belanja
      </a>

      <div className="bg-white p-8 rounded-xl shadow-lg w-full max-w-md border border-gray-200">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-green-700">Masuk Akun 🔐</h1>
          <p className="text-gray-500 text-sm">Pembeli & Penjual login di sini.</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700">Email</label>
            <input 
              type="email" 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 block w-full border border-gray-300 rounded-md p-2 text-gray-900 bg-white"
              required 
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Password</label>
            <input 
              type="password" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 block w-full border border-gray-300 rounded-md p-2 text-gray-900 bg-white"
              required 
            />
          </div>
          <button 
            disabled={loading}
            className="w-full bg-green-700 text-white py-2 rounded-md font-bold hover:bg-green-800 transition disabled:opacity-50 shadow-lg"
          >
            {loading ? 'Sedang Memproses...' : 'Masuk Sekarang'}
          </button>
        </form>

        <p className="text-center mt-6 text-sm text-gray-600">
          Belum punya akun? <a href="/register" className="text-green-700 font-bold hover:underline">Daftar Disini</a>
        </p>
      </div>
    </div>
  )
}