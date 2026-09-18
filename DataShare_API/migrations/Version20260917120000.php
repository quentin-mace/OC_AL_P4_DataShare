<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

/**
 * File is not exposed by the API yet (#11), so the table is empty in every
 * environment: the new columns can safely be added NOT NULL.
 */
final class Version20260917120000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'Add file.download_token and file.mime_type, needed by the file upload endpoint (#36).';
    }

    public function up(Schema $schema): void
    {
        $this->addSql('ALTER TABLE file ADD download_token VARCHAR(255) NOT NULL');
        $this->addSql('ALTER TABLE file ADD mime_type VARCHAR(255) NOT NULL');
        $this->addSql('CREATE UNIQUE INDEX UNIQ_8C9F3610704D2D87 ON file (download_token)');
    }

    public function down(Schema $schema): void
    {
        $this->addSql('DROP INDEX UNIQ_8C9F3610704D2D87');
        $this->addSql('ALTER TABLE file DROP download_token');
        $this->addSql('ALTER TABLE file DROP mime_type');
    }
}
