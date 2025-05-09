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
      if (ext === '.csv') {
         return this.importCSV(file.path);
      } else if (ext === '.xlsx') {
         return this.importXLSX(file.path);
      } else {
         throw new Error('Unsupported file type');
      }
   }

   // use manual checking for duplicates ========================
   async importCSV(filePath: string) {
      const rawRows: any[] = [];

      return new Promise((resolve, reject) => {
         fs.createReadStream(filePath)
            .pipe(csv())
            .on('data', (row) => rawRows.push(row))
            .on('end', async () => {
               const users: CreateUserDto[] = [];
               const newUsers: CreateUserDto[] = [];
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
                        OR: [{ email: user.email }, { id_no: user.id_no }]
                     }
                  });

                  if (!exists) {
                     newUsers.push(user);
                  } else {
                     duplicates.push(user);
                  }
               }

               await prisma.user.createMany({ data: newUsers });

               fs.unlink(filePath, (err) => {
                  if (err) console.error(`Failed to delete file: ${filePath}`, err);
               });

               resolve({
                  message: 'CSV import completed',
                  inserted: newUsers.length,
                  duplicates: duplicates.length,
               });
            })
            .on('error', reject);
      });
   }

   async importXLSX(filePath: string) {
      const workbook = XLSX.readFile(filePath);
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rawData = XLSX.utils.sheet_to_json(sheet);

      const users: CreateUserDto[] = [];
      const newUsers: CreateUserDto[] = [];
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
               OR: [
                  { email: user.email },
                  { id_no: user.id_no },
               ],
            },
         });

         if (!exists) {
            newUsers.push(user);
         } else {
            duplicates.push(user);
         }
      }

      // Simpan hanya user yang valid dan tidak duplikat
      await prisma.user.createMany({ data: newUsers });

      // Hapus file setelah proses
      fs.unlink(filePath, (err) => {
         if (err) console.error(`Failed to delete file: ${filePath}`, err);
      });

      return {
         message: 'XLSX import completed',
         inserted: newUsers.length,
         duplicates: duplicates.length,
      };
   }
   // =======================================================

   // use prisma to check for duplicates ========================
   async importCSVBackUp(filePath: string) {
      const users: CreateUserDto[] = [];
      return new Promise((resolve, reject) => {
         fs.createReadStream(filePath)
            .pipe(csv())
            .on('data', async (row) => {
               const dto = plainToInstance(CreateUserDto, row);
               const errors = await validate(dto);
               if (errors.length === 0) {
                  users.push(dto);
               } else {
                  console.warn(`Invalid row skipped:`, errors);
               }
            })
            .on('end', async () => {
               await prisma.user.createMany({
                  data: users,
                  skipDuplicates: true,
               });
               fs.unlink(filePath, (err) => {
                  if (err) console.error(`Failed to delete: ${filePath}`, err);
               });
               resolve({ message: 'CSV imported successfully', count: users.length });
            })
            .on('error', reject);
      });
   }

   async importXLSXBackup(filePath: string) {
      const workbook = XLSX.readFile(filePath);
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rawData = XLSX.utils.sheet_to_json(sheet);
      const users: CreateUserDto[] = [];

      for (const row of rawData) {
         const dto = plainToInstance(CreateUserDto, row);
         const errors = await validate(dto);
         if (errors.length === 0) {
            users.push(dto);
         } else {
            console.warn(`Invalid row skipped:`, errors);
         }
      }

      await prisma.user.createMany({
         data: users,
         skipDuplicates: true,
      });

      fs.unlink(filePath, (err) => {
         if (err) console.error(`Failed to delete: ${filePath}`, err);
      });

      return { message: 'XLSX imported successfully', count: users.length };
   }
   // ========================================================
}
