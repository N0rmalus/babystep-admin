"use client";

import { ColumnDef } from "@tanstack/react-table";

export type SubCategoryColumn = {
    id: string
    name: string
    billboardLabel: string
    createdAt: string
}

export const columns: ColumnDef<SubCategoryColumn>[] = [
    {
        accessorKey: "name",
        header: "Pavadinimas",
    },
    // {
    //     accessorKey: "billboard",
    //     header: "Skelbimų lenta",
    //     cell: ({ row }) => row.original.billboardLabel,
    // },
    {
        accessorKey: "createdAt",
        header: "Data",
    },
    {
        id: "actions",
        cell: ({ row }) => <div></div>
    },
]

