"use client"
import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase' 
import { useRouter } from 'next/navigation'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts'

export default function AdminPage() {
  const router = useRouter()
  
  // --- STATE ---
  const [activeTab, setActiveTab] = useState('stok') 
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  
  // Data Stok
  const [items, setItems] = useState([])
  const [stats, setStats] = useState({ totalMenu: 0, totalStok: 0, potensiDuit: 0 })
  const [chartData, setChartData] = useState([]) 
  
  // Form & Edit
  const [uploading, setUploading] = useState(false)
  const [imageFile, setImageFile] = useState(null)
  const [editMode, setEditMode] = useState(false) 
  const [editId, setEditId] = useState(null)      
  const [formData, setFormData] = useState({ nama: '', harga: '', tgl: '', stok: '', kategori: 'Makanan Berat' })

  // Profil & Jam Operasional
  const [profile, setProfile] = useState({ store_name: '', whatsapp_number: '', opening_hour: '', closing_hour: '' })
  const [savingProfile, setSavingProfile] = useState(false)

  // Kasir / Redeem
  const [redeemCode, setRedeemCode] = useState('')

  // 1. INIT
  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/login'); return }
      
      setUser(session.user)
      await autoCleanExpiredItems(session.user.id)
      fetchItems(session.user.id)
      
      // Ambil Data Profil Termasuk Jam Buka
      const { data: profileData } = await supabase.from('profiles').select('*').eq('id', session.user.id).single()
      if (profileData) {
          setProfile({ 
              store_name: profileData.store_name || '', 
              whatsapp_number: profileData.whatsapp_number || '',
              opening_hour: profileData.opening_hour || '',
              closing_hour: profileData.closing_hour || ''
          })
      }
    }
    init()
  }, [])

  // --- AUTO CLEAN ---
  const autoCleanExpiredItems = async (userId) => {
    const today = new Date().toISOString().split('T')[0]
    const { data: expiredItems } = await supabase.from('items').select('*').eq('user_id', userId).lt('expiry_date', today)

    if (expiredItems && expiredItems.length > 0) {
      for (const item of expiredItems) {
        if (item.image_url) {
          const fileName = item.image_url.split('/').pop()
          await supabase.storage.from('food_images').remove([fileName])
        }
      }
      await supabase.from('items').delete().eq('user_id', userId).lt('expiry_date', today)
      alert(`🧹 Sistem Otomatis: ${expiredItems.length} barang kadaluarsa telah dihapus.`)
    }
  }

  const fetchItems = async (userId) => {
    const { data } = await supabase.from('items').select('*').eq('user_id', userId).order('created_at', { ascending: false })
    if (data) {
      setItems(data)
      hitungStatistik(data)
      olahDataGrafik(data)
    }
    setLoading(false)
  }

  const hitungStatistik = (data) => {
    const totalMenu = data.length
    const totalStok = data.reduce((acc, item) => acc + item.stock, 0)
    const potensiDuit = data.reduce((acc, item) => acc + ((item.price * 0.5) * item.stock), 0)
    setStats({ totalMenu, totalStok, potensiDuit })
  }

  const olahDataGrafik = (data) => {
    const kategoriGrup = {}
    data.forEach(item => {
      const potensi = (item.price * 0.5) * item.stock
      if (kategoriGrup[item.category]) kategoriGrup[item.category] += potensi
      else kategoriGrup[item.category] = potensi
    })
    const chartArray = Object.keys(kategoriGrup).map((key, index) => ({
      name: key,
      total: kategoriGrup[key],
      color: ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8'][index % 5]
    }))
    setChartData(chartArray)
  }

  // --- HANDLERS PROFIL ---
  const handleUpdateProfile = async (e) => {
    e.preventDefault()
    setSavingProfile(true)
    const { error } = await supabase.from('profiles').update({ 
        store_name: profile.store_name, 
        whatsapp_number: profile.whatsapp_number,
        opening_hour: profile.opening_hour, 
        closing_hour: profile.closing_hour  
    }).eq('id', user.id)

    if (error) alert("Gagal: " + error.message); else alert("✅ Pengaturan Toko Disimpan!")
    setSavingProfile(false)
  }

  // --- HANDLERS STOK ---
  const handleChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value })
  const handleFileChange = (e) => { if (e.target.files && e.target.files.length > 0) setImageFile(e.target.files[0]) }

  const handleEditClick = (item) => {
    setEditMode(true); setEditId(item.id)
    setFormData({ nama: item.name, harga: item.price, tgl: item.expiry_date, stok: item.stock, kategori: item.category || 'Makanan Berat' })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }
  const handleCancelEdit = () => {
    setEditMode(false); setEditId(null)
    setFormData({ nama: '', harga: '', tgl: '', stok: '', kategori: 'Makanan Berat' }); setImageFile(null)
  }

  const handleSubmit = async (e) => {
    e.preventDefault(); if (!user) return
    if (Number(formData.harga) < 0 || Number(formData.stok) < 0) { alert("Tidak boleh negatif!"); return }
    const today = new Date().toISOString().split('T')[0]
    if (formData.tgl < today) { alert("Barang sudah expired!"); return }
    if (imageFile && imageFile.size > 2 * 1024 * 1024) { alert("File max 2MB!"); return }

    setUploading(true); let newImageUrl = null
    if (imageFile) {
      const fileName = `${user.id}_${Date.now()}_${imageFile.name.replace(/[^a-zA-Z0-9.]/g, '_')}`
      const { error: uploadError } = await supabase.storage.from('food_images').upload(fileName, imageFile)
      if (uploadError) { alert("Upload Gagal"); setUploading(false); return }
      const { data } = supabase.storage.from('food_images').getPublicUrl(fileName)
      newImageUrl = data.publicUrl
    }

    const baseData = {
      name: formData.nama, price: Number(formData.harga), expiry_date: formData.tgl,
      stock: Number(formData.stok), category: formData.kategori, user_id: user.id
    }
    if (newImageUrl) baseData.image_url = newImageUrl

    if (editMode) {
      const { error } = await supabase.from('items').update(baseData).eq('id', editId)
      if (!error) {
        const updated = items.map(i => i.id === editId ? { ...i, ...baseData, image_url: newImageUrl || i.image_url } : i)
        setItems(updated); hitungStatistik(updated); olahDataGrafik(updated)
      }
    } else {
      const { error } = await supabase.from('items').insert([baseData])
      if (!error) fetchItems(user.id)
    }
    setUploading(false); alert(editMode ? "Updated!" : "Saved!"); handleCancelEdit()
  }

  const handleDelete = async (item) => {
    if (!confirm(`Hapus ${item.name}?`)) return
    if (item.image_url) {
      const fileName = item.image_url.split('/').pop()
      await supabase.storage.from('food_images').remove([fileName])
    }
    await supabase.from('items').delete().eq('id', item.id)
    const sisa = items.filter(x => x.id !== item.id)
    setItems(sisa); hitungStatistik(sisa); olahDataGrafik(sisa)
  }

  // --- HANDLER KASIR (VERSI DETEKTIF LENGKAP) ---
  const handleRedeem = async () => {
    // 1. Bersihkan Kode
    const cleanCode = redeemCode.trim().toUpperCase()
    if(!cleanCode) return

    console.log("Mengecek kode:", cleanCode)

    // 2. CEK 1: Apakah kodenya ADA di database? (Tanpa peduli siapa yang punya)
    const { data: tiketApapun, error } = await supabase
        .from('transactions')
        .select('*')
        .eq('unique_code', cleanCode)
        .maybeSingle() // Pakai maybeSingle biar gak error kalau kosong

    // Kalau error database / RLS
    if (error) {
        alert("⚠️ Error Database: " + error.message + "\n(Coba jalankan SQL Disable RLS di Supabase!)")
        return
    }

    // Kalau kode tidak ditemukan sama sekali
    if (!tiketApapun) {
        alert("❌ Kode Tidak Ditemukan!\nPastikan pembeli sudah dapat tiketnya.")
        return
    }

    // 3. CEK 2: Apakah tiket ini MILIK TOKO SAYA?
    // Bandingkan ID Penjual di Tiket vs ID Kamu yang sedang login
    if (tiketApapun.seller_id !== user.id) {
        alert(`⛔ BUKAN MILIK TOKO INI!\n\nTiket ini milik Toko ID: ${tiketApapun.seller_id}\nSedangkan ID Anda: ${user.id}\n\nSolusi: Login pakai akun toko yang benar atau buat barang baru.`)
        return
    }

    // 4. CEK 3: Apakah statusnya masih PENDING?
    if (tiketApapun.status !== 'pending') {
        alert(`⚠️ TIKET SUDAH TERPAKAI!\nStatus saat ini: ${tiketApapun.status}`)
        return
    }

    // --- KALAU LOLOS SEMUA PENGECEKAN DI ATAS, BARU PROSES ---
    
    if (!confirm(`Verifikasi Pesanan Valid: \n📦 ${tiketApapun.item_name} (x${tiketApapun.quantity}) \n💰 Total: Rp ${tiketApapun.total_price.toLocaleString()} \n\nLanjutkan?`)) return
    
    // Update Status
    await supabase.from('transactions').update({ status: 'completed' }).eq('id', tiketApapun.id)
    
    // Kurangi Stok
    const { data: itemData } = await supabase.from('items').select('stock').eq('id', tiketApapun.item_id).single()
    if(itemData) { 
        await supabase.from('items').update({ stock: itemData.stock - tiketApapun.quantity }).eq('id', tiketApapun.item_id) 
    }
    
    alert("✅ BERHASIL! Transaksi Selesai.")
    setRedeemCode(''); fetchItems(user.id) 
  }

  const handleLogout = async () => { await supabase.auth.signOut(); router.push('/login') }

  if (loading) return <div className="text-center p-10 font-bold text-gray-500">Memuat Dashboard...</div>

  return (
    <div className="min-h-screen bg-gray-50 p-6 md:p-10 font-sans text-gray-800">
      <div className="max-w-6xl mx-auto">
        <div className="bg-white p-4 rounded-xl shadow-sm mb-8">
          <div className="flex justify-between items-center mb-6">
            <div><h1 className="text-2xl font-extrabold text-gray-800">Admin Panel 🚀</h1><p className="text-sm text-gray-500">{profile.store_name || user?.email}</p></div>
            <button onClick={handleLogout} className="text-red-600 font-bold text-sm border border-red-200 px-4 py-2 rounded-lg hover:bg-red-50">Keluar</button>
          </div>
          <div className="flex gap-4 border-b overflow-x-auto">
            <button onClick={() => setActiveTab('stok')} className={`pb-3 px-2 text-sm font-bold transition whitespace-nowrap ${activeTab === 'stok' ? 'border-b-2 border-green-600 text-green-700' : 'text-gray-400'}`}>📦 Kelola Stok</button>
            <button onClick={() => setActiveTab('kasir')} className={`pb-3 px-2 text-sm font-bold transition whitespace-nowrap ${activeTab === 'kasir' ? 'border-b-2 border-purple-600 text-purple-700' : 'text-gray-400'}`}>📟 Kasir / Validasi</button>
            <button onClick={() => setActiveTab('settings')} className={`pb-3 px-2 text-sm font-bold transition whitespace-nowrap ${activeTab === 'settings' ? 'border-b-2 border-blue-600 text-blue-700' : 'text-gray-400'}`}>⚙️ Pengaturan Toko</button>
          </div>
        </div>

        {activeTab === 'kasir' && (
             <div className="max-w-xl mx-auto bg-white p-8 rounded-2xl shadow-lg border-2 border-purple-100 text-center">
                <h2 className="text-2xl font-black text-gray-800 mb-2">📟 Validasi Tiket</h2>
                <p className="text-gray-400 mb-6 text-sm">Masukkan Kode Unik dari Pembeli</p>
                <input 
                    value={redeemCode} 
                    // AUTO CLEAN: Trim Spasi & Uppercase saat ngetik/paste
                    onChange={(e) => setRedeemCode(e.target.value.toUpperCase().trim())} 
                    placeholder="RSQ-XXXX" 
                    className="w-full text-center text-3xl font-mono font-bold border-2 border-gray-300 rounded-xl p-4 mb-4 uppercase focus:border-purple-500 outline-none tracking-widest transition" 
                />
                <button onClick={handleRedeem} className="w-full bg-purple-600 text-white font-bold py-4 rounded-xl text-lg hover:bg-purple-700 shadow-xl transition transform active:scale-95">VERIFIKASI TIKET 🎫</button>
             </div>
        )}

        {/* --- SETTINGS dengan JAM BUKA/TUTUP --- */}
        {activeTab === 'settings' && (
             <div className="max-w-xl mx-auto bg-white p-8 rounded-2xl shadow-sm border">
                <h2 className="text-xl font-bold mb-6 text-gray-800">⚙️ Edit Profil Toko</h2>
                <form onSubmit={handleUpdateProfile} className="space-y-5">
                    <div><label className="text-xs font-bold text-gray-500">Nama Toko</label><input value={profile.store_name} onChange={(e) => setProfile({...profile, store_name: e.target.value})} className="w-full border p-3 rounded-lg" /></div>
                    <div><label className="text-xs font-bold text-gray-500">Nomor WA (628...)</label><input type="number" value={profile.whatsapp_number} onChange={(e) => setProfile({...profile, whatsapp_number: e.target.value})} className="w-full border p-3 rounded-lg" /></div>
                    
                    <div className="grid grid-cols-2 gap-4">
                        <div><label className="text-xs font-bold text-gray-500">Jam Buka</label><input type="time" value={profile.opening_hour} onChange={(e) => setProfile({...profile, opening_hour: e.target.value})} className="w-full border p-3 rounded-lg" /></div>
                        <div><label className="text-xs font-bold text-gray-500">Jam Tutup</label><input type="time" value={profile.closing_hour} onChange={(e) => setProfile({...profile, closing_hour: e.target.value})} className="w-full border p-3 rounded-lg" /></div>
                    </div>

                    <button disabled={savingProfile} className="w-full bg-blue-600 text-white font-bold py-3 rounded-xl">{savingProfile ? '...' : 'Simpan Pengaturan'}</button>
                </form>
             </div>
        )}

        {activeTab === 'stok' && (
            <>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                  <div className="bg-white p-6 rounded-2xl shadow-sm border-l-4 border-blue-500"><p className="text-gray-400 text-xs font-bold uppercase">Total Menu</p><h2 className="text-3xl font-extrabold text-gray-800">{stats.totalMenu}</h2></div>
                  <div className="bg-white p-6 rounded-2xl shadow-sm border-l-4 border-orange-500"><p className="text-gray-400 text-xs font-bold uppercase">Total Stok</p><h2 className="text-3xl font-extrabold text-gray-800">{stats.totalStok}</h2></div>
                  <div className="bg-white p-6 rounded-2xl shadow-sm border-l-4 border-green-500"><p className="text-gray-400 text-xs font-bold uppercase">Potensi Omzet</p><h2 className="text-3xl font-extrabold text-green-600">Rp {stats.potensiDuit.toLocaleString()}</h2></div>
                </div>

                {items.length > 0 && (
                  <div className="bg-white p-6 rounded-2xl shadow-sm border mb-8"><h3 className="font-bold text-gray-700 mb-4">📊 Potensi Pendapatan</h3><div className="h-64 w-full"><ResponsiveContainer width="100%" height="100%"><BarChart data={chartData}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="name" tick={{fontSize: 12}} /><YAxis tickFormatter={(value) => `Rp ${value/1000}k`} tick={{fontSize: 12}} /><Tooltip formatter={(value) => `Rp ${value.toLocaleString()}`} /><Bar dataKey="total" radius={[4, 4, 0, 0]}>{chartData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}</Bar></BarChart></ResponsiveContainer></div></div>
                )}

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                  <div className="lg:col-span-1">
                    <div className={`p-6 rounded-2xl shadow-sm border sticky top-10 ${editMode ? 'bg-yellow-50 border-yellow-400' : 'bg-white'}`}>
                      <div className="flex justify-between items-center mb-4"><h2 className="font-bold text-lg">{editMode ? '✏️ EDIT DATA' : '📸 TAMBAH BARU'}</h2>{editMode && <button onClick={handleCancelEdit} className="text-xs text-red-600">Batal</button>}</div>
                      <form onSubmit={handleSubmit} className="space-y-4">
                        <input name="nama" value={formData.nama} onChange={handleChange} placeholder="Nama Produk" className="w-full border p-2 rounded-lg" required />
                        <select name="kategori" value={formData.kategori} onChange={handleChange} className="w-full border p-2 rounded-lg bg-white">{['Makanan Berat', 'Roti & Kue', 'Cemilan', 'Minuman', 'Bahan Mentah'].map(k => <option key={k} value={k}>{k}</option>)}</select>
                        <div className="grid grid-cols-2 gap-2"><input name="harga" type="number" value={formData.harga} onChange={handleChange} placeholder="Harga" className="w-full border p-2 rounded-lg" required /><input name="stok" type="number" value={formData.stok} onChange={handleChange} placeholder="Stok" className="w-full border p-2 rounded-lg" required /></div>
                        <input name="tgl" type="date" value={formData.tgl} onChange={handleChange} className="w-full border p-2 rounded-lg" required />
                        <div className="border-2 border-dashed p-3 rounded-lg text-center bg-gray-50 hover:bg-white"><p className="text-xs text-gray-400 mb-1">{editMode ? 'Ganti Foto (Opsional)' : 'Upload Foto'}</p><input type="file" accept="image/*" onChange={handleFileChange} className="text-xs w-full" /></div>
                        <button disabled={uploading} className={`w-full text-white font-bold py-3 rounded-xl shadow-lg ${editMode ? 'bg-yellow-600' : 'bg-green-600'}`}>{uploading ? '...' : (editMode ? 'SIMPAN' : 'UPLOAD')}</button>
                      </form>
                    </div>
                  </div>

                  <div className="lg:col-span-2">
                    <div className="bg-white rounded-2xl shadow-sm border overflow-hidden">
                      <div className="p-4 border-b bg-gray-50"><h3 className="font-bold text-gray-700">Daftar Stok ({items.length})</h3></div>
                      <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="bg-white text-gray-500 border-b"><tr><th className="p-4">Produk</th><th className="p-4">Stok</th><th className="p-4">Harga</th><th className="p-4 text-center">Aksi</th></tr></thead><tbody className="divide-y">{items.map(item => (<tr key={item.id} className={`hover:bg-gray-50 transition ${editId === item.id ? 'bg-yellow-50' : ''}`}><td className="p-4"><div className="flex items-center gap-3">{item.image_url ? <img src={item.image_url} className="w-10 h-10 rounded-lg object-cover border" /> : <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center text-xs">📷</div>}<div><p className="font-bold text-gray-800">{item.name}</p><span className="text-[10px] bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded border border-blue-100">{item.category}</span></div></div></td><td className="p-4">{item.stock < 5 ? <span className="bg-red-100 text-red-600 px-2 py-1 rounded font-bold animate-pulse text-xs">Sisa {item.stock}</span> : <span className="bg-green-100 text-green-700 px-2 py-1 rounded font-bold text-xs">{item.stock}</span>}</td><td className="p-4"><div className="flex flex-col"><span className="text-gray-400 text-[10px] line-through">Rp {item.price}</span><span className="font-bold text-gray-700">Rp {item.price * 0.5}</span></div></td><td className="p-4"><div className="flex justify-center gap-2"><button onClick={() => handleEditClick(item)} className="bg-yellow-100 text-yellow-700 px-3 py-1.5 rounded-lg text-xs font-bold border border-yellow-200">Edit</button><button onClick={() => handleDelete(item.id)} className="bg-red-100 text-red-600 px-3 py-1.5 rounded-lg text-xs font-bold border border-red-200">Hapus</button></div></td></tr>))}</tbody></table>{items.length === 0 && <p className="text-center p-10 text-gray-400">Belum ada barang.</p>}</div>
                    </div>
                  </div>
                </div>
            </>
        )}
      </div>
    </div>
  )
}