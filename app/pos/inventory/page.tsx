import { redirect } from 'next/navigation'

// 在庫はカタログに統合されたのでリダイレクト
export default function InventoryRedirect() {
    redirect('/pos/catalog?filter=instock')
}
