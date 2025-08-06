import { getPublicMenu } from '@/lib/actions/menu-management'
import { getProdotti } from '@/lib/actions/ordinazioni'
import MenuClient from './menu-client'
import { CartProvider } from '@/contexts/cart-context'
import { Toaster } from 'sonner'

export default async function MenuPage() {
  const [menuData, productsData] = await Promise.all([
    getPublicMenu(),
    getProdotti()
  ])
  
  return (
    <CartProvider>
      <MenuClient 
        initialMenu={menuData.menu || []} 
        products={productsData || []}
      />
      <Toaster position="bottom-center" />
    </CartProvider>
  )
}