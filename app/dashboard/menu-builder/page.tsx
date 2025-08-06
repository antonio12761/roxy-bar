import { getMenuGroups } from '@/lib/actions/menu-management'
import { getAllProducts } from '@/lib/actions/products-import'
import MenuBuilderClient from './menu-builder-client'

export default async function MenuBuilderPage() {
  const [menuData, productsData] = await Promise.all([
    getMenuGroups(),
    getAllProducts()
  ])

  return (
    <div className="container mx-auto p-6">
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Menu Builder</h1>
          <p className="text-muted-foreground">
            Gestisci gruppi, categorie e prodotti del menu pubblico
          </p>
        </div>

        <MenuBuilderClient 
          initialGroups={menuData.groups || []}
          availableProducts={productsData.products || []}
        />
      </div>
    </div>
  )
}