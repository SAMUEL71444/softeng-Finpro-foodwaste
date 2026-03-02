"use client"
import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase' 
import { useRouter } from 'next/navigation'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts'

export default function SuperAdminPage() {
  const router = useRouter()
  
  // --- STATE ---
  const [activeTab, setActiveTab] = useState('dashboard') 
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  
  // Data Master
  const [allUsers, setAllUsers] = useState([])
  const [allTransactions, setAllTransactions] = useState([])
  const [categories, setCategories] = useState([])
  const [newCategory, setNewCategory] = useState('')
  
  // Statistik
  const [stats, setStats] = useState({ totalUsers: 0, totalTrx: 0, totalOmzet: 0, pendingWithdraw: 0 }) 
  const [chartData, setChartData] = useState([])      
  
  // 1. INIT & CEK PANGKAT
  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/login'); return }
      
      // 🔥 CEK PANGKAT: Hanya Super Admin yang boleh masuk!
      const { data: profileData } = await supabase.from('profiles').select('*').eq('id', session.user.id).single()
      if (profileData?.role !== 'superadmin') {
          alert('⛔ Akses Ditolak! Halaman ini khusus Pemilik Aplikasi.')
          router.push('/')
          return
      }
      
      setUser(session.user)
      await fetchAllData()
    }
    init()
  }, [])

  // --- LOGIKA TARIK DATA KESELURUHAN ---
  const fetchAllData = async () => {
    setLoading(true)

    // 1. Ambil Semua User (Pembeli & Penjual)
    const { data: usersData } = await supabase.from('profiles').select('*').order('created_at', { ascending: false })
    
    // 2. Ambil Semua Transaksi
    const { data: trxData } = await supabase.from('transactions').select('*').order('created_at', { ascending: false })
    
    // 3. Ambil Kategori Master
    const { data: catData } = await supabase.from('categories').select('*').order('name', { ascending: true })

    if (usersData) setAllUsers(usersData)
    if (trxData) setAllTransactions(trxData)
    if (catData) setCategories(catData)

    // Kalkulasi Statistik Keseluruhan
    const totalUsers = usersData?.length || 0
    const totalTrx = trxData?.length || 0
    const totalOmzet = trxData?.filter(t => t.status === 'completed').reduce((acc, curr) => acc + curr.total_price, 0) || 0
    
    // Hitung total uang penjual yang belum ditarik (balance > 0)
    const pendingWithdraw = usersData?.reduce((acc, curr) => acc + (curr.balance || 0), 0) || 0

    setStats({ totalUsers, totalTrx, totalOmzet, pendingWithdraw })
    
    // Olah Grafik (Omzet berdasarkan tanggal)
    if (trxData) {
        const grouped = trxData.filter(t => t.status === 'completed').reduce((acc, curr) => {
            const date = new Date(curr.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })
            acc[date] = (acc[date] || 0) + curr.total_price
            return acc
        }, {})
        const chartArray = Object.keys(grouped).map((key, index) => ({
            tanggal: key, omzet: grouped[key], color: ['#8884d8', '#82ca9d', '#ffc658', '#ff7300'][index % 4] 
        })).slice(-7) // Ambil 7 hari terakhir
        setChartData(chartArray)
    }

    setLoading(false)
  }

  // --- HANDLERS SUPER ADMIN ---

  // 1. BLOKIR / BUKA BLOKIR USER
  const handleToggleBlock = async (userId, currentStatus) => {
      const newStatus = currentStatus === 'blocked' ? 'active' : 'blocked'
      const msg = newStatus === 'blocked' ? 'Blokir pengguna ini?' : 'Buka blokir pengguna ini?'
      if (!confirm(msg)) return

      await supabase.from('profiles').update({ status: newStatus }).eq('id', userId)
      alert(`User berhasil di-${newStatus}!`)
      fetchAllData()
  }

  // 2. APPROVE WITHDRAWAL (Pencairan Dana)
  const handleApproveWithdraw = async (sellerId, storeName, amount) => {
      if (!confirm(`Cairkan dana Rp ${amount.toLocaleString()} ke rekening ${storeName || 'Penjual'}?\n\n(Tindakan ini akan mereset saldo mereka menjadi 0)`)) return

      // Reset saldo penjual menjadi 0 (Tanda uang sudah ditransfer)
      await supabase.from('profiles').update({ balance: 0 }).eq('id', sellerId)
      alert('✅ Pencairan dana berhasil dikonfirmasi!')
      fetchAllData()
  }

  // 3. TAMBAH & HAPUS KATEGORI
  const handleAddCategory = async (e) => {
      e.preventDefault()
      if (!newCategory.trim()) return
      await supabase.from('categories').insert([{ name: newCategory.trim() }])
      setNewCategory('')
      fetchAllData()
  }
  const handleDeleteCategory = async (id, name) => {
      if (!confirm(`Hapus kategori master "${name}"?`)) return
      await supabase.from('categories').delete().eq('id', id)
      fetchAllData()
  }

  const handleLogout = async () => { await supabase.auth.signOut(); router.push('/login') }
  
  if (loading) return <div className="text-center p-10 font-bold text-gray-500">Memuat Markas Bos...</div>

  return (
    <div className="min-h-screen bg-gray-50 p-6 md:p-10 font-sans text-gray-800">
      <div className="max-w-6xl mx-auto">
        
        {/* HEADER & TABS */}
        <div className="bg-white p-4 rounded-xl shadow-sm mb-8 border-b-4 border-indigo-600">
          <div className="flex justify-between items-center mb-6">
            <div><h1 className="text-2xl font-extrabold text-indigo-900">👑 Markas Super Admin</h1><p className="text-sm text-gray-500">Kendali Penuh ResQ-Food</p></div>
            <button onClick={handleLogout} className="text-red-600 font-bold text-sm border border-red-200 px-4 py-2 rounded-lg hover:bg-red-50">Keluar</button>
          </div>
          <div className="flex gap-4 border-b overflow-x-auto">
            {[
                { id: 'dashboard', label: '📊 Dashboard' }, 
                { id: 'users', label: '👥 Kelola User' }, 
                { id: 'trx', label: '💸 Transaksi' },
                { id: 'withdraw', label: '🏦 Tarik Dana' },
                { id: 'kategori', label: '🏷️ Kategori' }
            ].map(tab => (
                <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`pb-3 px-2 text-sm font-bold transition whitespace-nowrap ${activeTab === tab.id ? 'border-b-2 border-indigo-600 text-indigo-700' : 'text-gray-400'}`}>
                    {tab.label}
                </button>
            ))}
          </div>
        </div>

        {/* 1. KONTEN DASHBOARD */}
        {activeTab === 'dashboard' && (
            <>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
                  <div className="bg-white p-6 rounded-2xl shadow-sm border-l-4 border-blue-500"><p className="text-gray-400 text-xs font-bold uppercase">Total User</p><h2 className="text-3xl font-extrabold text-gray-800">{stats.totalUsers}</h2></div>
                  <div className="bg-white p-6 rounded-2xl shadow-sm border-l-4 border-orange-500"><p className="text-gray-400 text-xs font-bold uppercase">Total Transaksi</p><h2 className="text-3xl font-extrabold text-gray-800">{stats.totalTrx}</h2></div>
                  <div className="bg-white p-6 rounded-2xl shadow-sm border-l-4 border-green-500"><p className="text-gray-400 text-xs font-bold uppercase">Omzet Platform</p><h2 className="text-2xl font-extrabold text-green-600">Rp {stats.totalOmzet.toLocaleString()}</h2></div>
                  <div className="bg-gradient-to-br from-indigo-600 to-purple-700 p-6 rounded-2xl shadow-lg text-white"><p className="text-indigo-200 text-xs font-bold uppercase">Antrean Dana Penjual</p><h2 className="text-2xl font-extrabold mb-1">Rp {stats.pendingWithdraw.toLocaleString()}</h2><p className="text-[10px] opacity-80">Menunggu dicairkan</p></div>
                </div>

                {chartData.length > 0 && (
                  <div className="bg-white p-6 rounded-2xl shadow-sm border mb-8"><h3 className="font-bold text-gray-700 mb-4">📈 Pergerakan Omzet Platform (7 Hari Terakhir)</h3><div className="h-64 w-full"><ResponsiveContainer width="100%" height="100%"><BarChart data={chartData}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="tanggal" tick={{fontSize: 12}} /><YAxis tick={{fontSize: 12}} allowDecimals={false} /><Tooltip /><Bar dataKey="omzet" fill="#4f46e5" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer></div></div>
                )}
            </>
        )}

        {/* 2. KONTEN USERS (Blokir/Verifikasi) */}
        {activeTab === 'users' && (
            <div className="bg-white rounded-2xl shadow-sm border overflow-hidden">
                <div className="p-4 border-b bg-gray-50"><h3 className="font-bold text-gray-700">Daftar Pengguna ({allUsers.length})</h3></div>
                <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="bg-white text-gray-500 border-b"><tr><th className="p-4">ID / Toko</th><th className="p-4">Pangkat</th><th className="p-4 text-center">Aksi (Blokir)</th></tr></thead><tbody className="divide-y">{allUsers.map(u => (
                    <tr key={u.id} className="hover:bg-gray-50 transition">
                        <td className="p-4"><p className="font-bold">{u.store_name || 'Pembeli Biasa'}</p><p className="text-[10px] text-gray-400">{u.id}</p></td>
                        <td className="p-4"><span className={`px-2 py-1 rounded text-xs font-bold ${u.role === 'superadmin' ? 'bg-purple-100 text-purple-700' : u.store_name ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'}`}>{u.role || (u.store_name ? 'seller' : 'buyer')}</span></td>
                        <td className="p-4 text-center">
                            {u.role !== 'superadmin' && (
                                <button onClick={() => handleToggleBlock(u.id, u.status)} className={`px-3 py-1 rounded-lg text-xs font-bold ${u.status === 'blocked' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
                                    {u.status === 'blocked' ? 'Buka Blokir' : 'Blokir'}
                                </button>
                            )}
                        </td>
                    </tr>
                ))}</tbody></table></div>
            </div>
        )}

        {/* 3. KONTEN TRANSAKSI */}
        {activeTab === 'trx' && (
             <div className="bg-white rounded-2xl shadow-sm border overflow-hidden">
             <div className="p-4 border-b bg-gray-50"><h3 className="font-bold text-gray-700">Semua Transaksi Masuk</h3></div>
             <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="bg-white text-gray-500 border-b"><tr><th className="p-4">Kode</th><th className="p-4">Makanan</th><th className="p-4">Total Harga</th><th className="p-4 text-center">Status</th></tr></thead><tbody className="divide-y">{allTransactions.map(t => (
                 <tr key={t.id} className="hover:bg-gray-50">
                     <td className="p-4 font-mono font-bold text-xs">{t.unique_code}</td>
                     <td className="p-4">{t.item_name} <span className="text-gray-400">(x{t.quantity})</span></td>
                     <td className="p-4 font-bold text-green-600">Rp {t.total_price.toLocaleString()}</td>
                     <td className="p-4 text-center"><span className={`px-2 py-1 rounded text-[10px] font-bold uppercase ${t.status === 'completed' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>{t.status}</span></td>
                 </tr>
             ))}</tbody></table></div>
         </div>
        )}

        {/* 4. KONTEN WITHDRAWAL (Pencairan Dana Penjual) */}
        {activeTab === 'withdraw' && (
            <div className="bg-white rounded-2xl shadow-sm border overflow-hidden">
                <div className="p-4 border-b bg-gray-50"><h3 className="font-bold text-gray-700">Antrean Pencairan Dana Penjual</h3><p className="text-xs text-gray-400">Daftar toko yang memiliki saldo hasil jualan.</p></div>
                <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="bg-white text-gray-500 border-b"><tr><th className="p-4">Nama Toko</th><th className="p-4">Nomor WA</th><th className="p-4">Jumlah Saldo</th><th className="p-4 text-center">Aksi Cairkan</th></tr></thead><tbody className="divide-y">
                    {allUsers.filter(u => u.balance > 0).map(u => (
                    <tr key={u.id} className="hover:bg-gray-50">
                        <td className="p-4 font-bold">{u.store_name}</td>
                        <td className="p-4 text-xs">{u.whatsapp_number}</td>
                        <td className="p-4 font-bold text-indigo-600 text-lg">Rp {(u.balance || 0).toLocaleString()}</td>
                        <td className="p-4 text-center"><button onClick={() => handleApproveWithdraw(u.id, u.store_name, u.balance)} className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-xs font-bold hover:bg-indigo-700 shadow-sm">Kirim Dana ✅</button></td>
                    </tr>
                ))}
                {allUsers.filter(u => u.balance > 0).length === 0 && <tr><td colSpan="4" className="text-center p-8 text-gray-400">Tidak ada antrean penarikan dana.</td></tr>}
                </tbody></table></div>
            </div>
        )}

        {/* 5. KONTEN KATEGORI MASTER */}
        {activeTab === 'kategori' && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                <div className="md:col-span-1">
                    <div className="bg-white p-6 rounded-2xl shadow-sm border sticky top-10">
                        <h2 className="font-bold text-lg mb-4">🏷️ Tambah Kategori</h2>
                        <form onSubmit={handleAddCategory} className="space-y-4">
                            <input value={newCategory} onChange={(e) => setNewCategory(e.target.value)} placeholder="Misal: Minuman Manis" className="w-full border p-3 rounded-lg bg-gray-50 focus:bg-white focus:border-indigo-500 outline-none" required />
                            <button className="w-full bg-indigo-600 text-white font-bold py-3 rounded-xl shadow-lg hover:bg-indigo-700">TAMBAH</button>
                        </form>
                    </div>
                </div>
                <div className="md:col-span-2 bg-white rounded-2xl shadow-sm border overflow-hidden">
                     <div className="p-4 border-b bg-gray-50"><h3 className="font-bold text-gray-700">Master Kategori Sistem</h3></div>
                     <div className="p-4 flex flex-wrap gap-3">
                         {categories.map(c => (
                             <div key={c.id} className="bg-indigo-50 border border-indigo-100 text-indigo-800 px-4 py-2 rounded-full text-sm font-bold flex items-center gap-2">
                                 {c.name}
                                 <button onClick={() => handleDeleteCategory(c.id, c.name)} className="text-red-500 hover:text-red-700 ml-2">✖</button>
                             </div>
                         ))}
                         {categories.length === 0 && <p className="text-sm text-gray-400">Belum ada kategori master.</p>}
                     </div>
                </div>
            </div>
        )}

      </div>
    </div>
  )
}