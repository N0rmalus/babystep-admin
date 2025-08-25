import { ColumnDef } from "@tanstack/react-table";
import { CellAction } from "./cell-action";

export type SubCategoryColumn = {
    id: string;
    name: string;
    categoryName: string;
    createdAt: string;
};

export const columns: ColumnDef<SubCategoryColumn>[] = [
    {
        accessorKey: "name",
        header: "Pavadinimas",
    },
    {
        accessorKey: "categoryName",
        header: "Kategorija",
    },
    {
        accessorKey: "createdAt",
        header: "Sukurta",
    },
    {
        id: "actions",
        cell: ({ row }) => <CellAction data={row.original} />,
    },
];

