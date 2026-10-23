import { requireAdmin } from '@/lib/auth'
import { listPeople } from '@/lib/db'
import { addPerson, setPersonActive, updatePerson } from '../../actions'

export const metadata = { title: 'Çalışanlar · Freewill Gündem' }

export default async function PeoplePage() {
  await requireAdmin()
  const people = listPeople()
  return (
    <main className="desk">
      <header className="desk-head">
        <div>
          <h1>Çalışanlar</h1>
          <p>Görevlere sorumlu olarak atanan ekip. Ayrılan biri pasife alınır; geçmiş görevlerinde adı kalır, yeni görevlere atanamaz.</p>
        </div>
      </header>

      <form action={addPerson} className="card people-add">
        <h2>Çalışan ekle</h2>
        <label>
          Ad soyad
          <input name="name" required maxLength={80} placeholder="ör. Elif Kaya" />
        </label>
        <label>
          Rol
          <input name="role" maxLength={80} placeholder="ör. Mobil geliştirici" />
        </label>
        <button className="btn btn-red">Ekle</button>
      </form>

      {people.length === 0 ? (
        <p className="desk-empty">Henüz çalışan yok. Görevlere sorumlu atayabilmek için ekibi buraya ekleyin.</p>
      ) : (
        <ul className="people">
          {people.map((p) => (
            <li key={p.id} className={p.active ? '' : 'is-off'}>
              <form action={updatePerson} className="people-edit">
                <input type="hidden" name="id" value={p.id} />
                <input name="name" aria-label="Ad soyad" defaultValue={p.name} required maxLength={80} />
                <input name="role" aria-label="Rol" defaultValue={p.role} maxLength={80} placeholder="Rol" />
                <button className="btn">Kaydet</button>
              </form>
              <span className={p.active ? 'pill is-ok' : 'pill'}>{p.active ? 'Aktif' : 'Pasif'}</span>
              <form action={setPersonActive}>
                <input type="hidden" name="id" value={p.id} />
                <input type="hidden" name="active" value={p.active ? '0' : '1'} />
                <button className="btn btn-quiet">{p.active ? 'Pasife al' : 'Aktifleştir'}</button>
              </form>
            </li>
          ))}
        </ul>
      )}
    </main>
  )
}
