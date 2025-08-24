"use client";

import { ColumnDef } from "@tanstack/react-table";
import { CellAction } from "./cell-action";

export type ProductColumn = {
    id: string
    name: string
    price: string
    size: string
    category: string
    color: string
    isFeatured: boolean
    isArchived: boolean
    createdAt: string
}

export const columns: ColumnDef<ProductColumn>[] = [
    {
        accessorKey: "name",
        header: "Pavadinimas",
    },
    {
        accessorKey: "isArchived",
        header: "Archyvuota",
    },
    {
        accessorKey: "isFeatured",
        header: "Rekomenduojama",
    },
    {
        accessorKey: "price",
        header: "Kaina",
    },
    {
        accessorKey: "category",
        header: "Kategorija",
    },
    {
        accessorKey: "size",
        header: "Dydis",
    },
    {
        accessorKey: "color",
        header: "Spalva",
        cell: ({ row }) => (
            <div className="flex items-center gap-x-2">
                {row.original.color}
                <div className="h-6 w-6 rounded-full border" style={{ backgroundColor: row.original.color }} />
            </div>
        )
    },
    {
        accessorKey: "createdAt",
        header: "Data",
    },
    {
        id: "actions",
        cell: ({ row }) => <CellAction data={row.original} />
    },
]
