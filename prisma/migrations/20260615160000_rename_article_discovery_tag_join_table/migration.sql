-- Rename implicit M2M join table to match Prisma convention (_ArticleToDiscoveryTag)
ALTER TABLE "_ArticleDiscoveryTag" RENAME TO "_ArticleToDiscoveryTag";

ALTER INDEX "_ArticleDiscoveryTag_B_index"
    RENAME TO "_ArticleToDiscoveryTag_B_index";

ALTER TABLE "_ArticleToDiscoveryTag"
    RENAME CONSTRAINT "_ArticleDiscoveryTag_AB_pkey"
    TO "_ArticleToDiscoveryTag_AB_pkey";

ALTER TABLE "_ArticleToDiscoveryTag"
    RENAME CONSTRAINT "_ArticleDiscoveryTag_A_fkey"
    TO "_ArticleToDiscoveryTag_A_fkey";

ALTER TABLE "_ArticleToDiscoveryTag"
    RENAME CONSTRAINT "_ArticleDiscoveryTag_B_fkey"
    TO "_ArticleToDiscoveryTag_B_fkey";
