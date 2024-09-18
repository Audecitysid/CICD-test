-- CreateTable
CREATE TABLE "_GraphToSubCategory" (
    "A" INTEGER NOT NULL,
    "B" INTEGER NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "_GraphToSubCategory_AB_unique" ON "_GraphToSubCategory"("A", "B");

-- CreateIndex
CREATE INDEX "_GraphToSubCategory_B_index" ON "_GraphToSubCategory"("B");

-- AddForeignKey
ALTER TABLE "_GraphToSubCategory" ADD CONSTRAINT "_GraphToSubCategory_A_fkey" FOREIGN KEY ("A") REFERENCES "Graph"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_GraphToSubCategory" ADD CONSTRAINT "_GraphToSubCategory_B_fkey" FOREIGN KEY ("B") REFERENCES "SubCategory"("id") ON DELETE CASCADE ON UPDATE CASCADE;
