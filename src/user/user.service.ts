import { Injectable } from '@nestjs/common';
import * as fs from 'fs';
import * as csv from 'csv-parser';
import * as XLSX from 'xlsx';
import { PrismaClient } from '@prisma/client';
import * as path from 'path';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateUserDto } from './dto/create-user.dto';

const prisma = new PrismaClient();

@Injectable()
export class UserService {
  async importUsers(file: Express.Multer.File): Promise<any> {
    const ext = path.extname(file.originalname).toLowerCase();
    const filename = file.filename;

    // get the last batch
    const lastBatch = await prisma.batch.findFirst({
      orderBy: { batch: 'desc' },
    });

    // create new batch
    const newBatch = await prisma.batch.create({
      data: {
        batch: lastBatch ? lastBatch.batch + 1 : 1,
        filename,
        total_data: 0,
        total_inserted: 0,
        total_duplicated: 0,
      },
    });

    if (ext === '.csv') {
      return this.importCSV(file.path, newBatch.id);
    } else if (ext === '.xlsx') {
      return this.importXLSX(file.path, newBatch.id);
    } else {
      throw new Error('Unsupported file type');
    }
  }

  // use manual checking for duplicates ========================
  async importCSV(filePath: string, batchId: string) {
    const rawRows: any[] = [];

    return new Promise((resolve, reject) => {
      fs.createReadStream(filePath)
        .pipe(csv())
        .on('data', (row) => rawRows.push(row))
        .on('end', async () => {
          const users: CreateUserDto[] = [];
          const newUsers: any[] = [];
          const duplicates: CreateUserDto[] = [];

          for (const row of rawRows) {
            const dto = plainToInstance(CreateUserDto, row);
            const errors = await validate(dto);
            if (errors.length === 0) {
              users.push(dto);
            } else {
              console.warn('Invalid row skipped:', errors);
            }
          }

          for (const user of users) {
            const exists = await prisma.user.findFirst({
              where: {
                OR: [{ email: user.email }, { id_no: user.id_no }],
              },
            });

            if (!exists) {
              newUsers.push({ ...user, batchId });
            } else {
              duplicates.push(user);
            }
          }

          // update batch: total_data, total_inserted, total_duplicates
          await prisma.batch.update({
            where: { id: batchId },
            data: {
              total_data: users.length,
              total_inserted: newUsers.length,
              total_duplicated: duplicates.length,
            },
          });

          await prisma.user.createMany({ data: newUsers });

          resolve({
            message: 'CSV import completed',
            inserted: newUsers.length,
            duplicates: duplicates.length,
          });
        })
        .on('error', reject);
    });
  }

  async importXLSX(filePath: string, batchId: string) {
    const workbook = XLSX.readFile(filePath);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rawData = XLSX.utils.sheet_to_json(sheet);

    const users: CreateUserDto[] = [];
    const newUsers: any[] = [];
    const duplicates: CreateUserDto[] = [];

    // Validasi isi data
    for (const row of rawData) {
      const dto = plainToInstance(CreateUserDto, row);
      const errors = await validate(dto);
      if (errors.length === 0) {
        users.push(dto);
      } else {
        console.warn(`Invalid row skipped:`, errors);
      }
    }

    // Cek manual duplikat ke database
    for (const user of users) {
      const exists = await prisma.user.findFirst({
        where: {
          OR: [{ email: user.email }, { id_no: user.id_no }],
        },
      });

      if (!exists) {
        newUsers.push({ ...user, batchId });
      } else {
        duplicates.push(user);
      }
    }

    // update batch: total_data, total_inserted, total_duplicates
    await prisma.batch.update({
      where: { id: batchId },
      data: {
        total_data: users.length,
        total_inserted: newUsers.length,
        total_duplicated: duplicates.length,
      },
    });

    // Simpan hanya user yang valid dan tidak duplikat
    await prisma.user.createMany({ data: newUsers });

    return {
      message: 'XLSX import completed',
      inserted: newUsers.length,
      duplicates: duplicates.length,
    };
  }
  // =======================================================
}
