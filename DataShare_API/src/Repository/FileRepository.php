<?php

namespace App\Repository;

use App\Entity\File;
use App\Entity\User;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry;

/**
 * @extends ServiceEntityRepository<File>
 */
class FileRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, File::class);
    }

    /**
     * The whole history of an owner, expired files included: the dashboard
     * lists them too, and its Tous/Actifs/Expire filter runs client-side on
     * the loaded collection.
     *
     * Tags are eagerly fetched, every row exposing its tag names.
     *
     * @return list<File>
     */
    public function findByOwner(User $owner, ?string $tag = null): array
    {
        $queryBuilder = $this->createQueryBuilder('f')
            ->leftJoin('f.tags', 't')
            ->addSelect('t')
            ->andWhere('f.owner = :owner')
            ->setParameter('owner', $owner)
            ->orderBy('f.uploadDate', 'DESC');

        if (null !== $tag) {
            // Filtering on the joined alias would also strip the other tags
            // from the fetched rows, so the match is made on a separate join.
            $queryBuilder
                ->innerJoin('f.tags', 'filtered')
                ->andWhere('filtered.name = :tag')
                // A tag belongs to its owner, two users may share a name.
                ->andWhere('filtered.owner = :owner')
                ->setParameter('tag', $tag);
        }

        /** @var list<File> $files */
        $files = $queryBuilder->getQuery()->getResult();

        return $files;
    }
}
